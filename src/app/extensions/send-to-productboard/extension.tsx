import {showDialog, runQuery, showToast, Extensions} from "attio/client"

import {createLogger} from "../../../utils/logger"
import getPersonDataQuery from "../../../record/actions/get-person-data.graphql"
import {parsePersonFromGraphql} from "../../../record/actions/parse-graphql-record"
import {PersonFeedbackDialog} from "../../../record/actions/person-feedback-dialog"

const logger = createLogger("send-to-productboard")

export default Extensions.defineExtension({
    type: "record-action",
    id: "send-to-productboard",
    label: "Send feedback",
    objects: "people",
    onTrigger: async ({recordId}) => {
        try {
            const result = await runQuery(getPersonDataQuery, {recordId})
            const person = parsePersonFromGraphql(result.person)

            if (!person) {
                await showToast({
                    variant: "error",
                    title: "Person not found",
                    durationMs: 8000,
                })
                return
            }

            showDialog({
                title: "Send feedback",
                Dialog: ({hideDialog}) => (
                    <PersonFeedbackDialog
                        feedbackText=""
                        initialPersonRecordId={recordId}
                        hideDialog={hideDialog}
                    />
                ),
            })
        } catch (error) {
            logger.error("Error loading person data:", error)
            await showToast({
                variant: "error",
                title: "Error",
                text: "Failed to load person data. Please try again.",
                durationMs: 8000,
            })
        }
    },
})
