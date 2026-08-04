import {companyValuesSchema, fetchAttioRecordValues, firstNonEmpty} from "./record-values"
import type {CompanyContact} from "./record-values"

export type {CompanyContact} from "./record-values"

export default async function getCompanyContact({
    recordId,
}: {
    recordId: string
}): Promise<CompanyContact> {
    const values = await fetchAttioRecordValues({object: "companies", recordId})
    const parsed = companyValuesSchema.parse(values)

    return {
        name: firstNonEmpty(parsed.name?.map((entry) => entry.value)),
        domain: firstNonEmpty(parsed.domains?.map((entry) => entry.domain)),
    }
}
