import {searchProductboardFeaturesByName} from "../../productboard/list-features.server"

export type {ProductboardFeature} from "../../productboard/types"

export default async function searchProductboardFeatures(query: string) {
    return searchProductboardFeaturesByName(query)
}
