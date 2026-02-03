import { RawEventDocument } from "@/infrastructure/mongo/schemas"
import { NormalizedEventDocument } from "@/infrastructure/mongo/schemas/normalized-events.schema"

export type EventNormalizer = {
	normalize(event: RawEventDocument): Promise<NormalizedEventDocument | null>
}
