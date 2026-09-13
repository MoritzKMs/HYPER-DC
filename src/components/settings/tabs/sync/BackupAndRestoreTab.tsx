/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { downloadSettingsBackup, uploadSettingsBackup } from "@api/SettingsSync/offline";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { hyperTranslate } from "@utils/hyperLanguage";
import { Margins } from "@utils/margins";
import { Button, Text } from "@webpack/common";

function BackupAndRestoreTab() {
    return (
        <SettingsTab>
            <Flex flexDirection="column" gap="0.5em">
                <Card variant="warning">
                    <Heading tag="h4">{hyperTranslate("Warning")}</Heading>
                    <Paragraph>{hyperTranslate("Importing a settings file will overwrite your current settings.")}</Paragraph>
                </Card>

                <Text variant="text-md/normal" className={Margins.bottom8}>
                    {hyperTranslate("You can import and export your Vencord settings as a JSON file. This allows you to easily transfer your settings to another device, or recover your settings after reinstalling Vencord or Discord.")}</Text>

                <Heading tag="h4">{hyperTranslate("Settings Export contains:")}</Heading>
                <Text variant="text-md/normal" className={Margins.bottom8}>
                    <ul>
                        <li>{hyperTranslate("&mdash; Custom QuickCSS")}</li>
                        <li>{hyperTranslate("&mdash; Theme Links")}</li>
                        <li>{hyperTranslate("&mdash; Plugin Settings")}</li>
                    </ul>
                </Text>

                <Flex>
                    <Button onClick={() => uploadSettingsBackup()}>
                        {hyperTranslate("Import Settings")}</Button>
                    <Button onClick={downloadSettingsBackup}>
                        {hyperTranslate("Export Settings")}</Button>
                </Flex>
            </Flex>
        </SettingsTab >
    );
}

export default wrapTab(BackupAndRestoreTab, "Backup & Restore");
