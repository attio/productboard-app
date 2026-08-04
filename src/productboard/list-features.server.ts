import {isComplete} from "@attio/fetchable"
import {createLogger} from "../utils/logger"
import {productboardClient} from "./index"
import type {ProductboardFeature} from "./types"

const logger = createLogger("list-features")

export default async function listProductboardFeatures(): Promise<ProductboardFeature[]> {
    const result = await productboardClient.features.list()

    if (!isComplete(result)) {
        logger.error("Error fetching Productboard features", {error: result.error})
        return []
    }

    return result.value
}

export async function searchProductboardFeaturesByName(
    query: string
): Promise<ProductboardFeature[]> {
    const result = await productboardClient.features.searchByName(query)

    if (!isComplete(result)) {
        logger.error("Error searching Productboard features", {error: result.error})
        return []
    }

    return result.value
}
