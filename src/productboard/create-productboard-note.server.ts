import {type AsyncResult, errored, isComplete} from "@attio/fetchable"

import {toProductboardUserError, type ProductboardUserError} from "./client/errors"
import {resolveProductboardCustomerEmail} from "./customer-email"
import {productboardClient} from "./index"
import type {ProductboardLinkRelationship} from "./types"
import type {CreateNoteParams} from "./submit-productboard-insight.types"

function buildFeatureRelationships(featureId?: string): ProductboardLinkRelationship[] {
    if (!featureId) return []

    return [{type: "link", target: {id: featureId}}]
}

function formatNoteContent(
    feedbackText: string,
    params: Pick<CreateNoteParams, "personName" | "personEmail" | "companyName" | "companyDomain">
): string {
    const metadataLines: string[] = []

    const personEmail = params.personEmail.trim()
    const personName = params.personName.trim()
    const companyDomain = params.companyDomain?.trim() ?? ""
    const companyName = params.companyName?.trim() ?? ""

    if (personEmail) {
        if (personName) metadataLines.push(`Person name: ${personName}`)
        metadataLines.push(`User email: ${personEmail}`)
    }

    if (companyDomain) {
        const resolvedCompanyName = companyName || (!personEmail ? personName : "")
        if (resolvedCompanyName) metadataLines.push(`Company name: ${resolvedCompanyName}`)
        metadataLines.push(`Company domain: ${companyDomain}`)
        if (!personEmail) {
            const userEmail = resolveProductboardCustomerEmail({
                personEmail: params.personEmail,
                companyDomain: params.companyDomain,
            })
            if (userEmail) metadataLines.push(`User email: ${userEmail}`)
        }
    }

    if (personName && !personEmail && !companyDomain && personName !== companyName) {
        metadataLines.push(`Person name: ${personName}`)
    }

    if (companyName && !companyDomain) {
        metadataLines.push(`Company name: ${companyName}`)
    }

    if (metadataLines.length === 0) return feedbackText

    return `${feedbackText}\n\n${metadataLines.join("\n")}`
}

export default async function createProductboardNote({
    feedbackText,
    featureId,
    tagName,
    personName = "",
    personEmail = "",
    companyName,
    companyDomain,
}: Pick<
    CreateNoteParams,
    | "feedbackText"
    | "featureId"
    | "tagName"
    | "personName"
    | "personEmail"
    | "companyName"
    | "companyDomain"
>): AsyncResult<{id: string; url?: string}, ProductboardUserError> {
    const featureRelationships = buildFeatureRelationships(featureId)
    const createNoteResult = await productboardClient.notes.create({
        feedbackText: formatNoteContent(feedbackText, {
            personName,
            personEmail,
            companyName,
            companyDomain,
        }),
        tagName,
        relationships: featureRelationships.length > 0 ? featureRelationships : undefined,
    })

    if (!isComplete(createNoteResult)) {
        return errored(
            toProductboardUserError({
                action: "Submitting feedback to Productboard",
                error: createNoteResult.error,
            })
        )
    }

    return createNoteResult
}
