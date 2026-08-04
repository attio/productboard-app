import {isComplete} from "@attio/fetchable"
import {createLogger} from "../utils/logger"
import {productboardClient} from "./index"
import type {ProductboardTag} from "./types"

const logger = createLogger("list-tags")

export default async function listProductboardTags(): Promise<ProductboardTag[]> {
    const result = await productboardClient.tags.list()

    if (!isComplete(result)) {
        logger.error("Error fetching Productboard tags", {error: result.error})
        return []
    }

    return result.value
}
