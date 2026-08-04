import {complete, errored, isComplete, type AsyncResult} from "@attio/fetchable"
import {kv} from "attio/server"

import type {ProductboardUserError} from "./client/errors"
import linkProductboardNoteCustomer from "./link-productboard-note-customer.server"
import {resolveLinkCustomerResult} from "./map-productboard-link-result"

export type PendingNoteLink = {
    noteId: string
    noteUrl?: string
    customerEmail: string
}

const PENDING_LINK_TTL_SECONDS = 60 * 60 * 24

export function pendingNoteLinkByNoteKey(noteId: string): string {
    return `pb-pending-link:note:${noteId}`
}

export function pendingNoteLinkByExecutionKey(uniqueExecutionId: string): string {
    return `pb-pending-link:exec:${uniqueExecutionId}`
}

export function serializePendingNoteLink(pending: PendingNoteLink): string {
    return JSON.stringify(pending)
}

export function parsePendingNoteLink(value: string): PendingNoteLink | null {
    try {
        const parsed = JSON.parse(value) as Partial<PendingNoteLink>
        if (typeof parsed.noteId === "string" && typeof parsed.customerEmail === "string") {
            return {
                noteId: parsed.noteId,
                noteUrl: typeof parsed.noteUrl === "string" ? parsed.noteUrl : undefined,
                customerEmail: parsed.customerEmail,
            }
        }
    } catch {
        return null
    }

    return null
}

async function readPendingNoteLink(key: string): Promise<PendingNoteLink | null> {
    const entry = await kv.get(key)
    if (!entry || typeof entry.value !== "string") return null

    return parsePendingNoteLink(entry.value)
}

async function writePendingNoteLink(key: string, pending: PendingNoteLink): Promise<void> {
    await kv.set(key, serializePendingNoteLink(pending), {
        ttlInSeconds: PENDING_LINK_TTL_SECONDS,
    })
}

export async function getPendingNoteLinkByNoteId(noteId: string): Promise<PendingNoteLink | null> {
    return readPendingNoteLink(pendingNoteLinkByNoteKey(noteId))
}

export async function savePendingNoteLinkByNoteId(
    noteId: string,
    pending: PendingNoteLink
): Promise<void> {
    await writePendingNoteLink(pendingNoteLinkByNoteKey(noteId), pending)
}

export async function clearPendingNoteLinkByNoteId(noteId: string): Promise<void> {
    await kv.delete(pendingNoteLinkByNoteKey(noteId))
}

export async function getPendingNoteLinkByExecutionId(
    uniqueExecutionId: string
): Promise<PendingNoteLink | null> {
    return readPendingNoteLink(pendingNoteLinkByExecutionKey(uniqueExecutionId))
}

export async function savePendingNoteLinkByExecutionId(
    uniqueExecutionId: string,
    pending: PendingNoteLink
): Promise<void> {
    await writePendingNoteLink(pendingNoteLinkByExecutionKey(uniqueExecutionId), pending)
}

export async function clearPendingNoteLinkByExecutionId(uniqueExecutionId: string): Promise<void> {
    await kv.delete(pendingNoteLinkByExecutionKey(uniqueExecutionId))
}

export default async function retryPendingNoteLink(
    pending: PendingNoteLink,
    options?: {allowEventualConsistencyRetry?: boolean}
): AsyncResult<{id: string; url?: string}, ProductboardUserError> {
    const linkResult = await linkProductboardNoteCustomer({
        noteId: pending.noteId,
        customerEmail: pending.customerEmail,
        allowEventualConsistencyRetry: options?.allowEventualConsistencyRetry ?? false,
    })

    if (isComplete(linkResult)) {
        return complete({id: pending.noteId, url: pending.noteUrl})
    }

    const resolved = resolveLinkCustomerResult({
        linkResult,
        noteUrl: pending.noteUrl,
        noteId: pending.noteId,
        customerEmail: pending.customerEmail,
    })

    if (isComplete(resolved)) {
        return complete({id: pending.noteId, url: pending.noteUrl})
    }

    return errored(resolved.error)
}

export {retryPendingNoteLink}
