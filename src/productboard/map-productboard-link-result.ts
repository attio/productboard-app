import {type Result, errored, isComplete} from "@attio/fetchable"

import {isCustomerNotFoundError} from "./client/customer-not-found"
import type {ProductboardClientError} from "./client/productboard-client"
import {
    ProductboardNoteNotLinkedError,
    toProductboardUserError,
    type ProductboardUserError,
} from "./client/errors"

export function resolveLinkCustomerResult({
    linkResult,
    noteUrl,
    noteId,
    customerEmail,
}: {
    linkResult: Result<void, ProductboardClientError>
    noteUrl?: string
    noteId?: string
    customerEmail?: string
}): Result<void, ProductboardUserError> {
    if (isComplete(linkResult)) return linkResult

    if (isCustomerNotFoundError(linkResult.error)) {
        return errored(new ProductboardNoteNotLinkedError(noteUrl, noteId, customerEmail))
    }

    return errored(
        toProductboardUserError({
            action: "Linking feedback to Productboard customer",
            error: linkResult.error,
        })
    )
}
