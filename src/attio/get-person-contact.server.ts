import {fetchAttioRecordValues, firstNonEmpty, personValuesSchema} from "./record-values"
import type {PersonContact} from "./record-values"

export type {PersonContact} from "./record-values"

export default async function getPersonContact({
    recordId,
}: {
    recordId: string
}): Promise<PersonContact> {
    const values = await fetchAttioRecordValues({object: "people", recordId})
    const parsed = personValuesSchema.parse(values)

    return {
        name: firstNonEmpty(parsed.name?.map((entry) => entry.full_name)),
        email: firstNonEmpty(parsed.email_addresses?.map((entry) => entry.email_address)),
    }
}
