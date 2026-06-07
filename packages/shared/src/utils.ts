/** Branded-style ID string (uuid in Sprint 2 persistence). */
export type ID = string;

/** ISO-8601 datetime string. */
export type ISODateTime = string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

/** Common audit timestamps on persisted entities. */
export interface Timestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}