/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { useSettings } from "@api/Settings";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { hyperTranslate } from "@utils/hyperLanguage";
import { Margins } from "@utils/margins";
import { identity } from "@utils/misc";
import { Button, Forms, Modal,openModal, Select, Slider } from "@webpack/common";

export function NotificationSection() {
    return (
        <section className={Margins.top16}>
            <Forms.FormTitle tag="h5">{hyperTranslate("Notifications")}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom8}>
                {hyperTranslate("Settings for Notifications sent by Vencord. This does NOT include Discord notifications (messages, etc)")}</Forms.FormText>
            <Flex>
                <Button onClick={openNotificationSettingsModal}>
                    {hyperTranslate("Notification Settings")}</Button>
                <Button onClick={openNotificationLogModal}>
                    {hyperTranslate("View Notification Log")}</Button>
            </Flex>
        </section>
    );
}

export function openNotificationSettingsModal() {
    openModal(props => (
        <Modal
            {...props}
            size="lg"
            title={hyperTranslate("Notification Settings")}
        >
            <NotificationSettings />
        </Modal>
    ));
}

function NotificationSettings() {
    const settings = useSettings(["notifications.*"]).notifications;

    return (
        <>
            <Forms.FormTitle tag="h5">{hyperTranslate("Notification Style")}</Forms.FormTitle>
            {settings.useNative !== "never" && Notification?.permission === "denied" && (
                <ErrorCard style={{ padding: "1em" }} className={Margins.bottom8}>
                    <Forms.FormTitle tag="h5">{hyperTranslate("Desktop Notification Permission denied")}</Forms.FormTitle>
                    <Forms.FormText>{hyperTranslate("You have denied Notification Permissions. Thus, Desktop notifications will not work!")}</Forms.FormText>
                </ErrorCard>
            )}
            <Forms.FormText className={Margins.bottom8}>
                {hyperTranslate("Some plugins may show you notifications. These come in two styles:")}<ul>
                    <li><strong>{hyperTranslate("Vencord Notifications")}</strong>{hyperTranslate(": These are in-app notifications")}</li>
                    <li><strong>{hyperTranslate("Desktop Notifications")}</strong>{hyperTranslate(": Native Desktop notifications (like when you get a ping)")}</li>
                </ul>
            </Forms.FormText>
            <Select
                placeholder={hyperTranslate("Notification Style")}
                options={[
                    { label: hyperTranslate("Only use Desktop notifications when Discord is not focused"), value: "not-focused", default: true },
                    { label: hyperTranslate("Always use Desktop notifications"), value: "always" },
                    { label: hyperTranslate("Always use Vencord notifications"), value: "never" },
                ] satisfies Array<{ value: typeof settings["useNative"]; } & Record<string, any>>}
                closeOnSelect={true}
                select={v => settings.useNative = v}
                isSelected={v => v === settings.useNative}
                serialize={identity}
            />

            <Forms.FormTitle tag="h5" className={Margins.top16 + " " + Margins.bottom8}>{hyperTranslate("Notification Position")}</Forms.FormTitle>
            <Select
                isDisabled={settings.useNative === "always"}
                placeholder={hyperTranslate("Notification Position")}
                options={[
                    { label: hyperTranslate("Bottom Right"), value: "bottom-right", default: true },
                    { label: hyperTranslate("Top Right"), value: "top-right" },
                ] satisfies Array<{ value: typeof settings["position"]; } & Record<string, any>>}
                select={v => settings.position = v}
                isSelected={v => v === settings.position}
                serialize={identity}
            />

            <Forms.FormTitle tag="h5" className={Margins.top16 + " " + Margins.bottom8}>{hyperTranslate("Notification Timeout")}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom16}>{hyperTranslate("Set to 0s to never automatically time out")}</Forms.FormText>
            <Slider
                disabled={settings.useNative === "always"}
                markers={[0, 1000, 2500, 5000, 10_000, 20_000]}
                minValue={0}
                maxValue={20_000}
                initialValue={settings.timeout}
                onValueChange={v => settings.timeout = v}
                onValueRender={v => (v / 1000).toFixed(2) + "s"}
                onMarkerRender={v => (v / 1000) + "s"}
                stickToMarkers={false}
            />

            <Forms.FormTitle tag="h5" className={Margins.top16 + " " + Margins.bottom8}>{hyperTranslate("Notification Log Limit")}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom16}>
                {hyperTranslate("The amount of notifications to save in the log until old ones are removed. Set to") + " "}<code>0</code> {hyperTranslate("to disable Notification log and") + " "}<code>∞</code> {hyperTranslate("to never automatically remove old Notifications")}</Forms.FormText>
            <Slider
                markers={[0, 25, 50, 75, 100, 200]}
                minValue={0}
                maxValue={200}
                stickToMarkers={true}
                initialValue={settings.logLimit}
                onValueChange={v => settings.logLimit = v}
                onValueRender={v => v === 200 ? "∞" : v}
                onMarkerRender={v => v === 200 ? "∞" : v}
            />
        </>
    );
}
