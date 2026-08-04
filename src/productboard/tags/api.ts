import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {z} from "zod"

import {
    endpoints,
    fetchAllProductboardPages,
    productboardHttpClient,
    productboardPageLinksSchema,
    schemaParseError,
    type ProductboardClientError,
} from "../client/productboard-client"
import type {ProductboardTag} from "../types"

const noteTagsPageSchema = z.object({
    data: z.array(
        z.object({
            fields: z.object({tags: z.array(z.object({name: z.string()})).optional()}).optional(),
        })
    ),
    links: productboardPageLinksSchema,
})

const tagValueItemSchema = z.object({
    id: z.string(),
    name: z.string(),
})

const tagValuesPageSchema = z.object({
    data: z.array(tagValueItemSchema),
    links: productboardPageLinksSchema,
})

const noteConfigurationSchema = z.object({
    data: z.object({
        fields: z.object({
            tags: z
                .object({
                    values: z
                        .object({
                            data: z.array(tagValueItemSchema),
                            links: z.object({next: z.string().nullable().optional()}).optional(),
                        })
                        .optional(),
                })
                .optional(),
        }),
    }),
})

function toSortedTags(tagNames: string[]): ProductboardTag[] {
    return [...new Set(tagNames)]
        .filter((name) => name.trim() !== "")
        .sort((left, right) => left.localeCompare(right))
        .map((name) => ({id: name, name}))
}

function extractTagNamesFromNotesPage(data: z.infer<typeof noteTagsPageSchema>): string[] {
    return data.data.flatMap((note) => note.fields?.tags?.map((tag) => tag.name.trim()) ?? [])
}

async function collectPaginatedTagNames({
    tagNames,
    nextUrl,
    maxPages = 20,
}: {
    tagNames: string[]
    nextUrl?: string | null
    maxPages?: number
}): AsyncResult<string[], ProductboardClientError> {
    const collected = [...tagNames]
    let url: string | null = nextUrl ?? null
    let pageCount = 0

    while (url && pageCount < maxPages) {
        pageCount++
        const pageResult = await productboardHttpClient.get(url)
        if (isErrored(pageResult)) return pageResult

        const parsed = tagValuesPageSchema.safeParse(pageResult.value.data)
        if (!parsed.success) return errored(schemaParseError())

        collected.push(...parsed.data.data.map((item) => item.name.trim()))
        url = parsed.data.links?.next ?? null
    }

    return complete(collected)
}

export function createTagsApi() {
    async function listFromNoteConfiguration(): AsyncResult<
        ProductboardTag[],
        ProductboardClientError
    > {
        const configResult = await productboardHttpClient.get(
            endpoints.api.noteConfiguration("textNote")
        )
        if (isErrored(configResult)) return configResult

        const parsed = noteConfigurationSchema.safeParse(configResult.value.data)
        if (!parsed.success) return errored(schemaParseError())

        const tagValues = parsed.data.data.fields.tags?.values
        if (!tagValues) return complete([])

        const tagNamesResult = await collectPaginatedTagNames({
            tagNames: tagValues.data.map((item) => item.name.trim()),
            nextUrl: tagValues.links?.next,
        })
        if (isErrored(tagNamesResult)) return tagNamesResult

        return complete(toSortedTags(tagNamesResult.value))
    }

    async function listFromNotes(): AsyncResult<ProductboardTag[], ProductboardClientError> {
        const result = await fetchAllProductboardPages({
            initialUrl: endpoints.api.notesWithFields("tags"),
            schema: noteTagsPageSchema,
            getItems: extractTagNamesFromNotesPage,
            maxPages: 20,
        })
        if (isErrored(result)) return result

        return complete(toSortedTags(result.value))
    }

    async function list(): AsyncResult<ProductboardTag[], ProductboardClientError> {
        const configured = await listFromNoteConfiguration()
        if (!isErrored(configured) && configured.value.length > 0) return configured

        return listFromNotes()
    }

    return {list}
}
