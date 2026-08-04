import listProductboardFeaturesImpl from "../../productboard/list-features.server"

export type {ProductboardFeature} from "../../productboard/types"

export default async function getProductboardFeatures() {
    return listProductboardFeaturesImpl()
}
