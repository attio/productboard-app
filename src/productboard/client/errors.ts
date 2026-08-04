import {createLogger} from "../../utils/logger"
import {isCustomerNotFoundError} from "./customer-not-found"
import {ProductboardClientErrorCode, type ProductboardClientError} from "./productboard-client"
import {ProductboardUserError} from "./user-errors"

export {ProductboardNoteNotLinkedError, ProductboardUserError} from "./user-errors"

const logger = createLogger("productboard errors")

function formatProductboardUserError({
    action,
    error,
}: {
    action: string
    error: ProductboardClientError
}): string {
    const apiError = error.apiError

    if (apiError?.code === "access.missing_scope") {
        const missingScope = apiError.detail?.replace("Missing required scope ", "") ?? "unknown"

        return `${action} failed: the Productboard connection is missing the "${missingScope}" scope. Update scopes in your Productboard OAuth app and Attio connection settings, then reconnect Productboard in Attio. Required v2 scopes: entities:read entities:write notes:read notes:write users:pii:read`
    }

    if (apiError?.status === 401) {
        return `${action} failed: Productboard rejected the connection. Reconnect Productboard in Attio and try again.`
    }

    if (apiError?.status === 403) {
        return `${action} failed: Productboard rejected the request due to missing permissions. Reconnect with the required scopes and try again.`
    }

    if (isCustomerNotFoundError(error)) {
        return `${action} failed: Could not find or create the customer in Productboard. Check the contact details and try again.`
    }

    if (apiError?.status === 404) {
        return `${action} failed: The requested Productboard resource was not found. Try again or reconnect Productboard.`
    }

    if (apiError?.status === 422) {
        return `${action} failed: Productboard rejected the request. Check the contact details and try again.`
    }

    if (apiError?.status === 429) {
        return `${action} failed: Productboard rate limit reached. Wait a moment and try again.`
    }

    if (error.code === ProductboardClientErrorCode.NetworkError) {
        return `${action} failed: could not reach Productboard. Please try again.`
    }

    return `${action} failed. Please try again or reconnect Productboard in Attio.`
}

export function toProductboardUserError({
    action,
    error,
}: {
    action: string
    error: ProductboardClientError
}): ProductboardUserError {
    logger.error(action, {
        code: error.code,
        status: error.apiError?.status,
        requestId: error.apiError?.requestId,
        apiErrorCode: error.apiError?.code,
    })

    return new ProductboardUserError(
        formatProductboardUserError({action, error}),
        error.apiError?.status,
        error.apiError?.code,
        error.apiError?.title,
        error.apiError?.detail
    )
}
