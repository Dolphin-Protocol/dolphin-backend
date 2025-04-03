import {
  PaginatedEvents,
  PaginatedObjectsResponse,
  SuiClient,
} from '@mysten/sui/client';

export class SuiService {
  private client: SuiClient;
  private limit = 10;

  async queryEvents({
    module,
    packageId,
    // eventType,
    nextCursor,
  }: {
    module: string;
    packageId: string;
    // eventType: string;
    nextCursor?: PaginatedEvents['nextCursor'];
  }) {
    let hasNextPage = false;

    const data: PaginatedEvents['data'] = [];
    // console.log(`${packageId}::${module}::${eventType}`);
    do {
      const event = await this.client.queryEvents({
        query: {
          MoveEventModule: {
            package: packageId,
            module,
          },
          // MoveEventType: `${packageId}::${module}::${eventType}`,
        },
        limit: this.limit,
        cursor: nextCursor,
        order: 'ascending',
      });
      hasNextPage = event.hasNextPage;
      nextCursor = event.nextCursor;
      data.push(...event.data);
    } while (hasNextPage);

    return data;
  }

  async queryOwnedObjects({
    owner,
    module,
    packageId,
    type,
    nextCursor,
  }: {
    owner: string;
    module: string;
    packageId: string;
    type: string;
    nextCursor?: PaginatedObjectsResponse['nextCursor'];
  }) {
    let hasNextPage = false;

    const data: PaginatedObjectsResponse['data'] = [];
    console.log(`${packageId}::${module}::${type}`);
    do {
      const event = await this.client.getOwnedObjects({
        owner,
        filter: {
          StructType: `${packageId}::${module}::${type}`,
        },
        limit: this.limit,
        cursor: nextCursor,
        options: {
          showContent: true,
        },
      });
      hasNextPage = event.hasNextPage;
      nextCursor = event.nextCursor;
      data.push(...event.data);
    } while (hasNextPage);

    return data;
  }

  async queryObjects({ ids }: { ids: string[] }) {
    const objects = await this.client.multiGetObjects({
      ids,
      options: {
        showContent: true,
      },
    });
    return objects;
  }
}
