var download, upload;
Module.register("MMM-SnmpIntSpeed", {
    // Default module config.
    defaults: {
        customStyle: null,
        gaugeType: "minimal",
        text: "",
        dataFile: 'data/snmp.json',
        interval: 5,
        community: 'public',
        version: 2,
        host: "localhost",
        index: 1
    },

    payload: [],

    /**
     * Main entry point from MagicMirror
     *
     * @return {void}
     */
    start() {
        Log.info("Starting module: " + this.name)

        let speed = (this.config.hasOwnProperty("speed") ? (!/^(auto|0)$/i.test(this.config.speed) ? this.config.speed : false) : false)

        this.nodeHelperConfig = {
            gaugeType: this.config.gaugeType,
            community: this.config.community,
            version: this.config.version,
            interval: this.config.interval,
            host: this.config.host,
            index: this.config.index,
            speed: speed
        }

        this.initializeUpdate()
        this.setUpdateInterval()
    },

    /**
     * Creates a "timer" to update the page on a interval
     *
     * @return {void}
     */
    setUpdateInterval() {
        this.updater = setInterval(() => {
            this.initializeUpdate()
        }, this.config.interval * 1000)
    },

    /**
     * Send config to node helper to wait on the retrieval of new posts
     *
     * @return {void}
     */
    initializeUpdate() {
        this.sendSocketNotification('SNMP_POOL_SERVERS', { config: this.nodeHelperConfig })
    },

    /**
     * Load javascripts
     *
     * @return {void}
     */
    getScripts() {
        return [this.file('js/justgage-1.2.2/justgage.js'), this.file('js/justgage-1.2.2/raphael-2.1.4.min.js'), this.file('js/jquery.js')]
    },

    /**
     * Load CSS styles
     *
     * @return {void}
     */
    getStyles() {
        var styles = [this.file("css/style.css")]

        if (this.config.customStyle != null) { styles.push(this.file(this.config.customStyle)) }
        return styles
    },

    /**
     * Returns an HTML DOM object with the elements to be added to the page
     *
     * @return {object} wrapper an HTML DOM object with the elements to be added to the page
     */
    getDom() {
        var wrapper = document.createElement("div")

        var downloadSpeedGauge = document.createElement("div")
        downloadSpeedGauge.id = 'downloadSpeedGauge'

        var uploadSpeedGauge = document.createElement("div")
        uploadSpeedGauge.id = 'uploadSpeedGauge'

        wrapper.appendChild(downloadSpeedGauge)
        wrapper.appendChild(uploadSpeedGauge)

        return wrapper
    },

    /**
     * Process notifications from the application or other modules
     *
     * @return {void}
     */
    notificationReceived(notification, payload, sender) {
        if (notification == 'DOM_OBJECTS_CREATED') {
            this.addScript()
        }
    },

    /**
     * Process socket notification from node_helper
     *
     * @return {void}
     */
    socketNotificationReceived(notification, payload) {
        Log.log(this.name + " socketNotificationReceived:" + notification)

        if (notification == "SNMP_POOL_RESPONSE") {
            var down = payload.download
            var up = payload.upload
            var max = (this.nodeHelperConfig.speed != 0 ? this.nodeHelperConfig.speed : payload.highSpeed)
            upload.refresh(up, max)
            download.refresh(down, max)
        }
    },

    /**
     * Adds javascript to the page. This needs to be called after the
     * download and upload DIVs have been added to the page
     *
     * @return {void}
     */
    addScript(mode) {
        ifText = ""
        var script = document.createElement('script')
        if (this.config.gaugeType == 'minimal') {
            script.innerHTML = '' + //'var download, upload;' +
                'download = new JustGage({' +
                'id: "downloadSpeedGauge",' +
                'value: 50,' +
                'min: 0,' +
                'max: 100,' +
                'title: ' + ifText + ' "Download",' +
                'refreshAnimationType:"linear",' +
                'gaugeWidthScale: "0.8",' +
                'valueFontColor: "#fff",' +
                'valueFontFamily: "Roboto Condensed",' +
                'titleFontFamily: "Roboto Condensed",' +
                'titleFontColor: "#aaa",' +
                'gaugeColor: "#000",' +
                'levelColors: ["#fff"],' +
                'hideInnerShadow: true,' +
                'hideMinMax: false,' +
                'decimals: 2,' +
                'label: "bps",' +
                'humanFriendly: true,' +
                'symbol: " "});' +
                'upload = new JustGage({' +
                'id: "uploadSpeedGauge",' +
                'value: ' + 0 + ',' +
                'min: 0,' +
                'max: 100,' +
                'title: ' + ifText + ' "Upload",' +
                'refreshAnimationType:"linear",' +
                'gaugeWidthScale: "0.8",' +
                'valueFontColor: "#fff",' +
                'valueFontFamily: "Roboto Condensed",' +
                'titleFontFamily: "Roboto Condensed",' +
                'titleFontColor: "#aaa",' +
                'gaugeColor: "#000",' +
                'levelColors: ["#fff"],' +
                'hideInnerShadow: true,' +
                'hideMinMax: false,' +
                'decimals: 2,' +
                'label: "bps",' +
                'humanFriendly: true,' +
                'symbol: " "});'
        } else {
            script.innerHTML = 'var download, upload;' +
                'download = new JustGage({' +
                'id: "downloadSpeedGauge",' +
                'value: ' + 0 + ',' +
                'min: 0,' +
                'max: 100,' +
                'title: ' + ifText + ' "Download",' +
                'refreshAnimationType:"linear",' +
                'gaugeWidthScale: "0.8",' +
                'valueFontColor: "#fff",' +
                'valueFontFamily: "Roboto Condensed",' +
                'titleFontFamily: "Roboto Condensed",' +
                'titleFontColor: "#aaa",' +
                'formatNumber: true,' +
                'hideMinMax: false,' +
                'decimals: 2,' +
                'label: "bps",' +
                'humanFriendly: true,' +
                'symbol: " "});' +
                'upload = new JustGage({' +
                'id: "uploadSpeedGauge",' +
                'value: ' + 0 + ',' +
                'min: 0,' +
                'max: 100,' +
                'title: ' + ifText + ' "Upload",' +
                'refreshAnimationType:"linear",' +
                'gaugeWidthScale: "0.8",' +
                'valueFontColor: "#fff",' +
                'valueFontFamily: "Roboto Condensed",' +
                'titleFontFamily: "Roboto Condensed",' +
                'titleFontColor: "#aaa",' +
                'formatNumber: true,' +
                'hideMinMax: false,' +
                'decimals: 2,' +
                'label: "bps",' +
                'humanFriendly: true,' +
                'symbol: "  "});'
        }
        $(script).appendTo('body')
    }

})