"use strict";
Component({
    properties: {
        beforeImage: { type: String, value: '' },
        afterImage: { type: String, value: '' },
        beforeLabel: { type: String, value: 'Before' },
        afterLabel: { type: String, value: 'After' },
        initialPercent: { type: Number, value: 50 },
        height: { type: String, value: '420rpx' },
    },
    data: {
        dividerPercent: 50,
        containerLeft: 0,
        containerWidth: 0,
    },
    observers: {
        initialPercent(value) {
            this.setData({
                dividerPercent: this.clampPercent(value),
            });
        },
    },
    lifetimes: {
        ready() {
            this.setData({
                dividerPercent: this.clampPercent(Number(this.properties.initialPercent || 50)),
            });
            this.measureContainer();
        },
    },
    methods: {
        clampPercent(value) {
            const safeValue = Number.isFinite(Number(value)) ? Number(value) : 50;
            if (safeValue < 0) {
                return 0;
            }
            if (safeValue > 100) {
                return 100;
            }
            return safeValue;
        },
        measureContainer() {
            const query = this.createSelectorQuery();
            query.select('.before-after-compare').boundingClientRect();
            query.exec((result) => {
                const rect = result && result[0];
                if (!rect) {
                    return;
                }
                this.setData({
                    containerLeft: Number(rect.left || 0),
                    containerWidth: Number(rect.width || 0),
                });
            });
        },
        updateDividerByPageX(pageX) {
            const containerWidth = Number(this.data.containerWidth || 0);
            if (containerWidth <= 0) {
                this.measureContainer();
                return;
            }
            const containerLeft = Number(this.data.containerLeft || 0);
            const relativeX = Number(pageX || 0) - containerLeft;
            const percent = (relativeX / containerWidth) * 100;
            this.setData({
                dividerPercent: this.clampPercent(percent),
            });
        },
        onTouchStart(event) {
            this.measureContainer();
            const touch = event.touches && event.touches[0];
            if (!touch) {
                return;
            }
            this.updateDividerByPageX(Number(touch.pageX || 0));
        },
        onTouchMove(event) {
            const touch = event.touches && event.touches[0];
            if (!touch) {
                return;
            }
            this.updateDividerByPageX(Number(touch.pageX || 0));
        },
        onImageTap() {
            const beforeImage = String(this.properties.beforeImage || '').trim();
            const afterImage = String(this.properties.afterImage || '').trim();
            const urls = [beforeImage, afterImage].filter(Boolean);
            if (urls.length === 0) {
                return;
            }
            wx.previewImage({
                current: afterImage || beforeImage,
                urls,
            });
        },
    },
});
