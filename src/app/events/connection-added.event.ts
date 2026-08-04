import {isErrored} from "@attio/fetchable"
import type {Connection} from "attio/server"

import {endpoints, productboardHttpClient} from "../../productboard/client/productboard-client"
import {createLogger} from "../../utils/logger"

const logger = createLogger("connection-added")

/**
 * Verifies the Productboard connection when a user adds it.
 * If this handler throws an error, the connection will not be created.
 */
export default async function connectionAdded({
    connection,
}: {
    connection: Connection
}): Promise<void> {
    logger.log("Productboard connection added", {
        connectionId: connection.id,
    })

    const result = await productboardHttpClient.get(endpoints.api.notesWithFields("name"), {
        accessToken: connection.value,
    })

    if (isErrored(result)) {
        logger.error("Error verifying Productboard connection:", result.error)
        throw new Error("Failed to verify Productboard connection")
    }

    logger.log("Productboard connection verified successfully")
}
