module.exports = {
    start(api) {
        api.ui([
            { id: "text", type: "textarea", label: "İşlenecek metin" },
            { id: "trim", type: "checkbox", label: "Başındaki ve sonundaki boşlukları temizle" },
            { id: "upper", type: "button", label: "Büyük harfe çevir" },
            { id: "lower", type: "button", label: "Küçük harfe çevir" },
            { id: "save", type: "button", label: "Tercihi kaydet" }
        ]);
        api.show("Son kaydedilen tercih: " + (api.settings.get().trim ? "Boşlukları temizle" : "Metni koru"));
    },
    async onAction(api, id, values) {
        if (id === "save") {
            try {
                await api.settings.set({ trim: values.trim });
                api.show("Tercihin kaydedildi. Yazdığın metin kaydedilmedi.");
            } catch (error) {
                api.show("Kaydedilemedi: " + error.message);
            }
            return;
        }
        const text = values.trim ? values.text.trim() : values.text;
        api.show(id === "upper" ? text.toLocaleUpperCase("tr-TR") : text.toLocaleLowerCase("tr-TR"));
    }
};
