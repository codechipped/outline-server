// Copyright 2020 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Table} from '@google-cloud/bigquery';
import {InsertableTable} from './infrastructure/table';
import {HourlyConnectionMetricsReport} from './model';

export interface ConnectionRow {
  serverId: string;
  startTimestamp: string; // ISO formatted string.
  endTimestamp: string; // ISO formatted string.
  bytesTransferred: number;
  tunnelTimeSec?: number;
  countries?: string[];
}

export class BigQueryConnectionsTable implements InsertableTable<ConnectionRow> {
  constructor(private bigqueryTable: Table) {}

  async insert(rows: ConnectionRow[]): Promise<void> {
    await this.bigqueryTable.insert(rows);
  }
}

export function postConnectionMetrics(
  table: InsertableTable<ConnectionRow>,
  report: HourlyConnectionMetricsReport
): Promise<void> {
  return table.insert(getConnectionRowsFromReport(report));
}

function getConnectionRowsFromReport(report: HourlyConnectionMetricsReport): ConnectionRow[] {
  const startTimestampStr = new Date(report.startUtcMs).toISOString();
  const endTimestampStr = new Date(report.endUtcMs).toISOString();
  const rows = [];
  for (const userReport of report.userReports) {
    rows.push({
      serverId: report.serverId,
      startTimestamp: startTimestampStr,
      endTimestamp: endTimestampStr,
      bytesTransferred: userReport.bytesTransferred,
      tunnelTimeSec: userReport.tunnelTimeSec || undefined,
      countries: userReport.countries || [],
    });
  }
  return rows;
}

// Returns true iff testObject contains a valid HourlyConnectionMetricsReport.
export function isValidConnectionMetricsReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  testObject: any
): testObject is HourlyConnectionMetricsReport {
  if (!testObject) {
    return false;
  }

  // Check that all required fields are present.
  const requiredConnectionMetricsFields = ['serverId', 'startUtcMs', 'endUtcMs', 'userReports'];
  for (const fieldName of requiredConnectionMetricsFields) {
    if (!testObject[fieldName]) {
      return false;
    }
  }

  // Check that `serverId` is a string.
  if (typeof testObject.serverId !== 'string') {
    return false;
  }

  // Check timestamp types and that startUtcMs is not after endUtcMs.
  if (
    typeof testObject.startUtcMs !== 'number' ||
    typeof testObject.endUtcMs !== 'number' ||
    testObject.startUtcMs >= testObject.endUtcMs
  ) {
    return false;
  }

  // Check that at least 1 user report has been provided.
  if (testObject.userReports.length === 0) {
    return false;
  }

  const MIN_BYTES_TRANSFERRED = 0;
  const MAX_BYTES_TRANSFERRED = 1 * Math.pow(2, 40); // 1 TB.
  for (const userReport of testObject.userReports) {
    // Check that `bytesTransferred` is a number between min and max transfer limits
    if (
      typeof userReport.bytesTransferred !== 'number' ||
      userReport.bytesTransferred < MIN_BYTES_TRANSFERRED ||
      userReport.bytesTransferred > MAX_BYTES_TRANSFERRED
    ) {
      return false;
    }

    if (
      userReport.tunnelTimeSec &&
      (typeof userReport.tunnelTimeSec !== 'number' || userReport.tunnelTimeSec < 0)
    ) {
      return false;
    }

    // We require at least 1 country to be set
    const countries = userReport.countries ?? [];
    if (countries.length === 0) {
      return false;
    }
    // Check that all `countries` are strings.
    for (const country of countries) {
      if (typeof country !== 'string') {
        return false;
      }
    }
  }

  // Request is a valid HourlyConnectionMetricsReport.
  return true;
}
