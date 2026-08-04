import {type AsyncResult, complete, errored, fromPromise, isErrored} from "@attio/fetchable"
import {ATTIO_API_TOKEN} from "attio/server"

import {createLogger} from "../utils/logger"
import {ATTIO_API_BASE_URL} from "./endpoints"
import type {AttioApiError} from "./error"

const logger = createLogger("attio client")

async function readErrorMessage(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as unknown
        if (
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
        ) {
            return body.message
        }
    } catch {
        // fall through to default
    }
    return `HTTP ${response.status}`
}

function httpStatusToAttioApiError(status: number): AttioApiError {
    switch (status) {
        case 400:
        case 422:
            return {code: "INVALID_REQUEST"}
        case 401:
            return {code: "UNAUTHORIZED"}
        case 403:
            return {code: "FORBIDDEN"}
        case 404:
            return {code: "NOT_FOUND"}
        case 409:
            return {code: "CONFLICT"}
        case 429:
            return {code: "RATE_LIMITED"}
        default:
            return status >= 500 ? {code: "ATTIO_API_ERROR"} : {code: "UNEXPECTED_ERROR"}
    }
}

function resolveUrl(urlOrPath: string): string {
    return urlOrPath.startsWith("http") ? urlOrPath : `${ATTIO_API_BASE_URL}${urlOrPath}`
}

async function attioRequest(
    method: "GET" | "POST",
    urlOrPath: string,
    body?: unknown
): AsyncResult<unknown, AttioApiError> {
    const url = resolveUrl(urlOrPath)

    const response = await fromPromise(
        fetch(url, {
            method,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${ATTIO_API_TOKEN}`,
                ...(body !== undefined ? {"Content-Type": "application/json"} : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        })
    )

    if (isErrored(response)) {
        logger.error(`Failed to ${method} ${url}: ${response.error}`)
        return errored({code: "UNEXPECTED_ERROR"})
    }

    const httpResponse = response.value

    logger.log(`${method} ${url} (${httpResponse.status})`)

    if (httpResponse.status === 404) {
        return errored({code: "NOT_FOUND"})
    }

    if (!httpResponse.ok) {
        const error = httpStatusToAttioApiError(httpResponse.status)
        const message = await readErrorMessage(httpResponse)
        logger.error(
            `${method} ${url} failed with ${httpResponse.status} (${error.code}): ${message}`
        )
        return errored(error)
    }

    try {
        return complete((await httpResponse.json()) as unknown)
    } catch {
        logger.error(`Invalid JSON from ${method} ${url}`)
        return errored({code: "UNEXPECTED_ERROR"})
    }
}

export const attioClient = {
    get(urlOrPath: string): AsyncResult<unknown, AttioApiError> {
        return attioRequest("GET", urlOrPath)
    },

    post(urlOrPath: string, body: unknown): AsyncResult<unknown, AttioApiError> {
        return attioRequest("POST", urlOrPath, body)
    },
}
