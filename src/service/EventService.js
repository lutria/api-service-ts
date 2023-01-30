import { subjects } from "@lutria/nats-common/src/index.js";

class EventService {
  constructor({ natsClient, logger, streamDao }) {
    this.natsClient = natsClient;
    this.logger = logger;
    this.streamDao = streamDao;
  }

  async start() {
    await this.natsClient.connect();

    this.natsClient.subscribe(
      subjects.STREAM_SCAN_REQUEST,
      "api-service",
      async (event) => this.handleStreamScanRequest(event)
    );
  }

  async handleStreamScanRequest(event) {
    const state = "SCAN_QUEUED";
    this.logger.info(`Updating state of stream ${event.name} to ${state}`);
    await this.streamDao.update(event.name, { state });
  }
}

export default EventService;
