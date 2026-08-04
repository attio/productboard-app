import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {z} from "zod"

import {
    endpoints,
    productboardHttpClient,
    schemaParseError,
    type ProductboardClientError,
} from "../client/productboard-client"

const entityReferenceSchema = z.object({
    data: z.object({id: z.string()}),
})

const entityListSchema = z.object({
    data: z.array(
        z.object({
            id: z.string(),
            type: z.string(),
            fields: z.object({email: z.string().optional()}).optional(),
        })
    ),
})

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

function deriveUserName({email, name}: {email: string; name?: string}): string {
    if (name && name.trim() !== "") {
        return name.trim()
    }

    const localPart = email.split("@")[0]?.trim()
    return localPart !== "" ? localPart : email
}

function extractMatchingUserId({
    entities,
    email,
}: {
    entities: z.infer<typeof entityListSchema>["data"]
    email: string
}): string | null {
    const normalizedEmail = normalizeEmail(email)

    for (const entity of entities) {
        if (entity.type !== "user") continue

        const entityEmail = entity.fields?.email
        if (entityEmail && normalizeEmail(entityEmail) === normalizedEmail) {
            return entity.id
        }
    }

    return null
}

export function createCustomersApi() {
    async function searchByEmail(
        email: string
    ): AsyncResult<string | null, ProductboardClientError> {
        const responseResult = await productboardHttpClient.post(endpoints.api.entitiesSearch, {
            data: {
                filter: {
                    type: ["user"],
                    fields: {email: {contains: email}},
                },
                return: {fields: ["email", "name"]},
            },
        })

        if (isErrored(responseResult)) return responseResult

        const parsed = entityListSchema.safeParse(responseResult.value.data)
        if (!parsed.success) return errored(schemaParseError())

        return complete(extractMatchingUserId({entities: parsed.data.data, email}))
    }

    async function create({
        email,
        name,
    }: {
        email: string
        name?: string
    }): AsyncResult<string, ProductboardClientError> {
        const responseResult = await productboardHttpClient.post(endpoints.api.entities, {
            data: {
                type: "user",
                fields: {email, name: deriveUserName({email, name})},
            },
        })

        if (isErrored(responseResult)) return responseResult

        const parsed = entityReferenceSchema.safeParse(responseResult.value.data)
        if (!parsed.success) return errored(schemaParseError())

        return complete(parsed.data.data.id)
    }

    return {searchByEmail, create}
}
