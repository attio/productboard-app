import {complete, isErrored, type AsyncResult} from "@attio/fetchable"

import {ProductboardNoteNotLinkedError, type ProductboardUserError} from "./client/errors"
import {
    clearPendingNoteLinkByNoteId,
    getPendingNoteLinkByNoteId,
    retryPendingNoteLink,
} from "./pending-note-link.server"

export type RetryPendingNoteLinkResult = {
    linked: boolean
    id?: string
    url?: string
}

export default async function retryPendingNoteLinkByNoteId({
    noteId,
    allowEventualConsistencyRetry = false,
}: {
    noteId: string
    allowEventualConsistencyRetry?: boolean
}): AsyncResult<RetryPendingNoteLinkResult, ProductboardUserError> {
    const pending = await getPendingNoteLinkByNoteId(noteId)
    if (!pending) {
        return complete({linked: true})
    }

    const result = await retryPendingNoteLink(pending, {allowEventualConsistencyRetry})

    if (!isErrored(result)) {
        await clearPendingNoteLinkByNoteId(noteId)
        return complete({
            linked: true,
            id: result.value.id,
            url: result.value.url,
        })
    }

    if (result.error instanceof ProductboardNoteNotLinkedError) {
        return complete({linked: false, url: result.error.noteUrl})
    }

    return result
}
