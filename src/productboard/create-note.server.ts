import {
    type AsyncResult,
    combineAsync,
    complete,
    errored,
    isComplete,
    isErrored,
} from "@attio/fetchable"

import {isCustomerNotFoundError} from "./client/customer-not-found"
import {ProductboardUserError} from "./client/errors"
import {resolveProductboardCustomerEmail} from "./customer-email"
import createProductboardNote from "./create-productboard-note.server"
import {
    createProductboardCustomer,
    searchProductboardCustomer,
} from "./ensure-productboard-customer.server"
import linkProductboardNoteCustomer, {
    DEFAULT_FIXED_LINK_RETRY,
} from "./link-productboard-note-customer.server"
import {resolveLinkCustomerResult} from "./map-productboard-link-result"
import {savePendingNoteLinkByNoteId} from "./pending-note-link.server"
import type {
    CreateNoteParams,
    ProductboardNoteResult,
    SubmitProductboardInsightOptions,
} from "./submit-productboard-insight.types"

export type {
    CreateNoteParams,
    ProductboardNoteResult,
    ProductboardSubmitPhase,
    SubmitProductboardInsightOptions,
} from "./submit-productboard-insight.types"

export default async function submitProductboardInsight(
    params: CreateNoteParams,
    options?: SubmitProductboardInsightOptions
): AsyncResult<ProductboardNoteResult, ProductboardUserError> {
    const customerEmail = resolveProductboardCustomerEmail({
        personEmail: params.personEmail,
        companyDomain: params.companyDomain,
    })

    if (!customerEmail) {
        await options?.onProgress?.("creating-note")
        return createProductboardNote(params)
    }

    if (options?.ignoreLinkFailure) {
        await options?.onProgress?.("creating-note")
        const noteResult = await createProductboardNote(params)
        if (!isComplete(noteResult)) return noteResult

        await options?.onProgress?.("finding-contact")
        const customerSearchResult = await searchProductboardCustomer(params)
        if (isComplete(customerSearchResult) && !customerSearchResult.value) {
            const createCustomerResult = await createProductboardCustomer(params)
            if (!isComplete(createCustomerResult)) return createCustomerResult
        }

        await options?.onProgress?.("linking-contact")
        const linkResult = await linkProductboardNoteCustomer({
            noteId: noteResult.value.id,
            customerEmail,
            fixedIntervalRetry: options.fixedLinkRetry ?? DEFAULT_FIXED_LINK_RETRY,
        })

        return complete({
            ...noteResult.value,
            isNoteLinked: isComplete(linkResult),
        })
    }

    await options?.onProgress?.("creating-note")
    await options?.onProgress?.("finding-contact")

    const parallelResult = await combineAsync([
        createProductboardNote(params),
        searchProductboardCustomer(params),
    ] as const)

    if (isErrored(parallelResult)) return parallelResult

    const [note, customerSearchResult] = parallelResult.value

    if (!customerSearchResult) {
        const createCustomerResult = await createProductboardCustomer(params)
        if (!isComplete(createCustomerResult)) return createCustomerResult
    }

    await options?.onProgress?.("linking-contact")
    const linkResult = await linkProductboardNoteCustomer({
        noteId: note.id,
        customerEmail,
        allowEventualConsistencyRetry: false,
    })

    if (!isComplete(linkResult)) {
        if (options?.deferLinkOnFailure && isCustomerNotFoundError(linkResult.error)) {
            await savePendingNoteLinkByNoteId(note.id, {
                noteId: note.id,
                noteUrl: note.url,
                customerEmail,
            })

            return complete({...note, linkPending: true})
        }

        const linkFailure = resolveLinkCustomerResult({
            linkResult,
            noteUrl: note.url,
            noteId: note.id,
            customerEmail,
        })
        if (isErrored(linkFailure)) {
            return errored(linkFailure.error)
        }

        return errored(
            new ProductboardUserError("Failed to link feedback to a Productboard customer.")
        )
    }

    return complete(note)
}
