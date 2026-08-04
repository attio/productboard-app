import {isComplete} from "@attio/fetchable"
import {Workflows} from "attio/server"

import getCompanyContact from "../../../attio/get-company-contact.server"
import getPersonContact from "../../../attio/get-person-contact.server"
import {ProductboardUserError} from "../../../productboard/client/errors"
import submitProductboardInsight from "../../../productboard/create-note.server"
import {DEFAULT_FIXED_LINK_RETRY} from "../../../productboard/link-productboard-note-customer.server"
import {createLogger} from "../../../utils/logger"
import block from "./block"

const logger = createLogger("send-feedback-to-productboard")

function buildSuccessOutcome(note: {id: string; url?: string; isNoteLinked?: boolean}) {
    return {
        type: "outcome" as const,
        id: "success",
        data: {
            note_id: note.id,
            note_url: note.url ?? "",
            is_note_linked: note.isNoteLinked ?? false,
        },
    }
}

function buildErrorOutcome(error: unknown) {
    const baseMessage =
        error instanceof Error ? error.message : "Failed to send feedback to Productboard."

    if (error instanceof ProductboardUserError) {
        logger.error("Error sending feedback to Productboard from workflow block", {
            status: error.status,
            code: error.code,
            title: error.title,
        })

        const diagnostics = [
            error.code,
            error.status ? `HTTP ${error.status}` : undefined,
            error.detail,
        ]
            .filter((part): part is string => Boolean(part))
            .join(", ")

        return {
            type: "error" as const,
            errorMessage: diagnostics ? `${baseMessage} (${diagnostics})` : baseMessage,
            retryable: false,
        }
    }

    logger.error("Error sending feedback to Productboard from workflow block")

    return {type: "error" as const, errorMessage: baseMessage, retryable: false}
}

export default Workflows.defineWorkflowBlockExecute(block, async ({config}) => {
    const {person, company, feedback_text: feedbackText, tag} = config

    if (!feedbackText || feedbackText.trim() === "") {
        return {type: "error", errorMessage: "Feedback text is required.", retryable: false}
    }

    if (!person && !company) {
        return {
            type: "error",
            errorMessage: "Select a person and/or a company to send feedback for.",
            retryable: false,
        }
    }

    try {
        const [personContact, companyContact] = await Promise.all([
            person ? getPersonContact({recordId: person.recordId}) : null,
            company ? getCompanyContact({recordId: company.recordId}) : null,
        ])

        const personName = personContact?.name ?? ""
        const personEmail = personContact?.email ?? ""
        const companyName = companyContact?.name ?? ""
        const companyDomain = companyContact?.domain ?? ""

        const result = await submitProductboardInsight(
            {
                personName: personName || companyName,
                personEmail,
                companyName: companyName || undefined,
                companyDomain: companyDomain || undefined,
                feedbackText,
                tagName: tag && tag.trim() !== "" ? tag.trim() : undefined,
            },
            {
                ignoreLinkFailure: true,
                fixedLinkRetry: DEFAULT_FIXED_LINK_RETRY,
            }
        )

        if (isComplete(result)) {
            return buildSuccessOutcome(result.value)
        }

        return buildErrorOutcome(result.error)
    } catch (error) {
        return buildErrorOutcome(error)
    }
})
