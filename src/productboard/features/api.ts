import {type AsyncResult, complete, isErrored} from "@attio/fetchable"
import {z} from "zod"

import {
    endpoints,
    fetchAllProductboardPages,
    productboardPageLinksSchema,
    type ProductboardClientError,
} from "../client/productboard-client"
import type {ProductboardFeature} from "../types"

const featuresPageSchema = z.object({
    data: z.array(
        z.object({
            id: z.string(),
            fields: z.object({name: z.string()}),
        })
    ),
    links: productboardPageLinksSchema,
})

function parseFeatureEntities(data: z.infer<typeof featuresPageSchema>): ProductboardFeature[] {
    return data.data.map((feature) => ({id: feature.id, name: feature.fields.name}))
}

export function createFeaturesApi() {
    async function list(): AsyncResult<ProductboardFeature[], ProductboardClientError> {
        return fetchAllProductboardPages({
            initialUrl: endpoints.api.features,
            schema: featuresPageSchema,
            getItems: parseFeatureEntities,
        })
    }

    async function searchByName(
        query: string
    ): AsyncResult<ProductboardFeature[], ProductboardClientError> {
        const result = await list()
        if (isErrored(result)) return result

        if (!query || query.trim().length < 2) {
            return complete(result.value.slice(0, 50))
        }

        const queryLower = query.toLowerCase().trim()
        const filtered = result.value.filter((feature) =>
            feature.name.toLowerCase().includes(queryLower)
        )

        return complete(filtered.slice(0, 50))
    }

    return {list, searchByName}
}
