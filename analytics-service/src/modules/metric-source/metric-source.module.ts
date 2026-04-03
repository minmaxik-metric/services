import { Module } from "@nestjs/common"

import { MetricsReaderService } from "./metrics-reader.service"

@Module({
	providers: [MetricsReaderService],
	exports: [MetricsReaderService]
})
export class MetricSourceModule {}
