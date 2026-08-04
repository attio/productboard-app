import {type AsyncResult, type Result, complete, errored, isComplete} from "@attio/fetchable"
import {getWorkspaceConnection} from "attio/server"
import {z} from "zod"

import {createLogger} from "../../utils/logger"
import {PRODUCTBOARD_API_BASE_URL} from "./endpoints"

const logger = createLogger("productboard client")

export {endpoints} from "./endpoints"

export enum ProductboardClientErrorCode {
    HttpError = "http_error",
    NetworkError = "network_error",
    ValidationError = "validation_error",
}

type ProductboardApiErrorDetails = {
    status: number
    requestId?: string
    code?: string
    title?: string
    detail?: string
}

export type ProductboardClientError = {
    code: ProductboardClientErrorCode
    errorMessage: string
    apiError?: ProductboardApiErrorDetails
}

const productboardErrorResponseSchema = z.object({
    id: z.string().optional(),
    errors: z
        .array(
            z.object({
                detail: z.string().optional(),
                title: z.string().optional(),
                code: z.string().optional(),
            })
        )
        .optional(),
})

export const productboardPageLinksSchema = z
    .object({next: z.string().nullable().optional()})
    .optional()

type ProductboardApiResponse<T> = {
    statusCode: number
    data: T | undefined
}

function resolveUrl(urlOrPath: string): string {
    return urlOrPath.startsWith("http") ? urlOrPath : `${PRODUCTBOARD_API_BASE_URL}${urlOrPath}`
}

function parseApiErrorDetails(status: number, responseBody: string): ProductboardApiErrorDetails {
    try {
        const parsed = productboardErrorResponseSchema.parse(JSON.parse(responseBody))
        const firstError = parsed.errors?.[0]
        return {
            status,
            requestId: parsed.id,
            code: firstError?.code,
            title: firstError?.title,
            detail: firstError?.detail,
        }
    } catch {
        return {status}
    }
}

function networkErrorMessage(cause: unknown): string {
    if (cause instanceof Error) return cause.message
    return String(cause)
}

export function schemaParseError(): ProductboardClientError {
    return {
        code: ProductboardClientErrorCode.ValidationError,
        errorMessage: "Unexpected response shape from Productboard API",
    }
}

async function request<T>(
    method: "GET" | "POST" | "PUT",
    urlOrPath: string,
    options?: {body?: unknown; accessToken?: string}
): AsyncResult<ProductboardApiResponse<T>, ProductboardClientError> {
    const url = resolveUrl(urlOrPath)
    const accessToken = options?.accessToken ?? getWorkspaceConnection().value

    let response: Response
    try {
        response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: options?.body === undefined ? undefined : JSON.stringify(options.body),
        })
    } catch (cause) {
        logger.error("Productboard request failed", {url, cause})
        return errored({
            code: ProductboardClientErrorCode.NetworkError,
            errorMessage: networkErrorMessage(cause),
        })
    }

    const responseText = await response.text()

    if (!response.ok) {
        const apiError = parseApiErrorDetails(response.status, responseText)
        logger.error("Productboard request failed", {
            url,
            status: response.status,
            requestId: apiError.requestId,
            code: apiError.code,
        })
        return errored({
            code: ProductboardClientErrorCode.HttpError,
            errorMessage:
                apiError.title ??
                apiError.detail ??
                `Request failed with status ${response.status}`,
            apiError,
        })
    }

    if (!responseText) {
        return complete({statusCode: response.status, data: undefined})
    }

    try {
        return complete({
            statusCode: response.status,
            data: JSON.parse(responseText) as T,
        })
    } catch (cause) {
        logger.error("Failed to parse Productboard JSON response", {url, cause})
        return errored({
            code: ProductboardClientErrorCode.ValidationError,
            errorMessage: "Invalid JSON response from Productboard API",
        })
    }
}

async function get<T>(
    urlOrPath: string,
    options?: {accessToken?: string}
): AsyncResult<ProductboardApiResponse<T>, ProductboardClientError> {
    return request<T>("GET", urlOrPath, options)
}

async function post<T>(
    urlOrPath: string,
    body?: unknown,
    options?: {accessToken?: string}
): AsyncResult<ProductboardApiResponse<T>, ProductboardClientError> {
    return request<T>("POST", urlOrPath, {body, accessToken: options?.accessToken})
}

async function put<T>(
    urlOrPath: string,
    body?: unknown,
    options?: {accessToken?: string}
): AsyncResult<ProductboardApiResponse<T>, ProductboardClientError> {
    return request<T>("PUT", urlOrPath, {body, accessToken: options?.accessToken})
}

export const productboardHttpClient = {
    get,
    post,
    put,
}

export async function fetchAllProductboardPages<TSchema extends z.ZodType, T>({
    initialUrl,
    schema,
    getItems,
    maxPages = 50,
}: {
    initialUrl: string
    schema: TSchema
    getItems: (data: z.infer<TSchema>) => T[]
    maxPages?: number
}): AsyncResult<T[], ProductboardClientError> {
    const items: T[] = []
    let url: string | null = initialUrl
    let pageCount = 0

    while (url && pageCount < maxPages) {
        pageCount++
        const result: Result<
            ProductboardApiResponse<unknown>,
            ProductboardClientError
        > = await productboardHttpClient.get(url)
        if (!isComplete(result)) return result

        const parsed = schema.safeParse(result.value.data)
        if (!parsed.success) {
            logger.error("Unexpected Productboard response shape", {url, error: parsed.error})
            return errored(schemaParseError())
        }

        items.push(...getItems(parsed.data))
        const pageLinks: {next?: string | null} | undefined = (
            parsed.data as {links?: {next?: string | null}}
        ).links
        url = pageLinks?.next ?? null

        if (url && pageCount >= maxPages) {
            logger.error(
                "Paginated response truncated — more pages available but max page limit reached",
                {
                    initialUrl,
                    maxPages,
                    itemCount: items.length,
                }
            )
        }
    }

    return complete(items)
}
