module.exports = {
    start(api) {
        api.show("Metnini aşağıya yazıp Gönder'e bas.");
    },
    onInput(api, text) {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        api.show(`${text.length} karakter · ${words} kelime`);
    }
};
