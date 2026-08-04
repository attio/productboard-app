import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {z} from "zod"

import {
    endpoints,
    productboardHttpClient,
    schemaParseError,
    type ProductboardClientError,
} from "../client/productboard-client"
import type {ProductboardLinkRelationship} from "../types"

const noteReferenceSchema = z.object({
    data: z.object({
        id: z.string(),
        links: z.object({html: z.string().nullable().optional()}).optional(),
    }),
})

export type CreateNoteInput = {
    feedbackText: string
    tagName?: string
    relationships?: Array<ProductboardLinkRelationship>
}

export function createNotesApi() {
    async function create(
        input: CreateNoteInput
    ): AsyncResult<{id: string; url?: string}, ProductboardClientError> {
        const fields: {name: string; content: string; tags?: Array<{name: string}>} = {
            name: "Feedback from Attio",
            content: input.feedbackText,
        }

        if (input.tagName && input.tagName.trim() !== "") {
            fields.tags = [{name: input.tagName.trim()}]
        }

        const responseResult = await productboardHttpClient.post(endpoints.api.notes, {
            data: {
                type: "textNote",
                fields,
                ...(input.relationships?.length ? {relationships: input.relationships} : {}),
            },
        })

        if (isErrored(responseResult)) return responseResult

        const parsed = noteReferenceSchema.safeParse(responseResult.value.data)
        if (!parsed.success) return errored(schemaParseError())

        return complete({
            id: parsed.data.data.id,
            url: parsed.data.data.links?.html ?? undefined,
        })
    }

    async function linkCustomer({
        noteId,
        customerEmail,
    }: {
        noteId: string
        customerEmail: string
    }): AsyncResult<void, ProductboardClientError> {
        const responseResult = await productboardHttpClient.put(
            endpoints.api.noteCustomerRelationship(noteId),
            {
                data: {
                    target: {type: "user", email: customerEmail},
                },
            }
        )

        if (isErrored(responseResult)) return responseResult

        return complete(undefined)
    }

    return {create, linkCustomer}
}
