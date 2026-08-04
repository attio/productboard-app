import {isErrored} from "@attio/fetchable"
import {z} from "zod"

import {attioClient} from "./client"
import {endpoints} from "./endpoints"
import {createLogger} from "../utils/logger"

const logger = createLogger("attio record-values")

export const personValuesSchema = z.object({
    name: z
        .array(
            z.object({
                full_name: z.string().nullable().optional(),
            })
        )
        .optional(),
    email_addresses: z
        .array(
            z.object({
                email_address: z.string().nullable().optional(),
            })
        )
        .optional(),
})

export const companyValuesSchema = z.object({
    name: z
        .array(
            z.object({
                value: z.string().nullable().optional(),
            })
        )
        .optional(),
    domains: z
        .array(
            z.object({
                domain: z.string().nullable().optional(),
            })
        )
        .optional(),
})

const recordResponseSchema = z.object({
    data: z.object({
        values: z.unknown(),
    }),
})

export type PersonContact = {
    name: string
    email: string
}

export type CompanyContact = {
    name: string
    domain: string
}

export function firstNonEmpty(values: Array<string | null | undefined> | undefined): string {
    if (!values) {
        return ""
    }

    for (const value of values) {
        if (typeof value === "string" && value.trim() !== "") {
            return value.trim()
        }
    }

    return ""
}

export async function fetchAttioRecordValues({
    object,
    recordId,
}: {
    object: string
    recordId: string
}): Promise<unknown> {
    const result = await attioClient.get(endpoints.api.record(object, recordId))

    if (isErrored(result)) {
        logger.error("Failed to fetch Attio record", {object, code: result.error.code})

        if (result.error.code === "UNAUTHORIZED" || result.error.code === "FORBIDDEN") {
            throw new Error(
                `Could not read the ${object} record from Attio: the app is missing the "record_permission:read" and "object_configuration:read" scopes. Add them to the app in the Attio developer dashboard and reinstall the app.`
            )
        }

        throw new Error(`Failed to load the ${object} record from Attio.`)
    }

    const parsed = recordResponseSchema.safeParse(result.value)

    if (!parsed.success) {
        logger.error("Failed to parse Attio record response:", parsed.error)
        throw new Error("Received an invalid response from the Attio API.")
    }

    return parsed.data.data.values
}
