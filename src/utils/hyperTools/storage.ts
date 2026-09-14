/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PersonalItem, validateItems } from "./core";

export function createPersonalStorage(database: { get(key: string): Promise<unknown>; set(key: string, value: PersonalItem[]): Promise<void>; }) {
    let queue: Promise<unknown> = Promise.resolve();
    return {
        update(key: string, isOwner: () => boolean, change: (rows: PersonalItem[]) => PersonalItem[]) {
            const job = queue.then(async () => {
                if (!isOwner()) return false;
                const rows = validateItems(await database.get(key));
                if (!isOwner()) return false;
                const next = change(rows);
                if (next.length > 500) throw new Error("Personal storage is full");
                await database.set(key, validateItems(next));
                return isOwner();
            });
            // A failed save must not prevent subsequent independent saves.
            queue = job.catch(() => {});
            return job;
        }
    };
}
