(function(_global){
var require, define;
(function () {
    var mods = {};

    define = function (id, deps, factory) {
        mods[id] = {
            id: id,
            deps: deps,
            factory: factory,
            defined: 0,
            exports: {},
            require: createRequire(id)
        };
    };

    require = createRequire('');

    function normalize(id, baseId) {
        if (!baseId) {
            return id;
        }

        if (id.indexOf('.') === 0) {
            var basePath = baseId.split('/');
            var namePath = id.split('/');
            var baseLen = basePath.length - 1;
            var nameLen = namePath.length;
            var cutBaseTerms = 0;
            var cutNameTerms = 0;

            pathLoop: for (var i = 0; i < nameLen; i++) {
                switch (namePath[i]) {
                    case '..':
                        if (cutBaseTerms < baseLen) {
                            cutBaseTerms++;
                            cutNameTerms++;
                        }
                        else {
                            break pathLoop;
                        }
                        break;
                    case '.':
                        cutNameTerms++;
                        break;
                    default:
                        break pathLoop;
                }
            }

            basePath.length = baseLen - cutBaseTerms;
            namePath = namePath.slice(cutNameTerms);

            return basePath.concat(namePath).join('/');
        }

        return id;
    }

    function createRequire(baseId) {
        var cacheMods = {};

        function localRequire(id, callback) {
            if (typeof id === 'string') {
                var exports = cacheMods[id];
                if (!exports) {
                    exports = getModExports(normalize(id, baseId));
                    cacheMods[id] = exports;
                }

                return exports;
            }
            else if (id instanceof Array) {
                callback = callback || function () {};
                callback.apply(this, getModsExports(id, callback, baseId));
            }
        };

        return localRequire;
    }

    function getModsExports(ids, factory, baseId) {
        var es = [];
        var mod = mods[baseId];

        for (var i = 0, l = Math.min(ids.length, factory.length); i < l; i++) {
            var id = normalize(ids[i], baseId);
            var arg;
            switch (id) {
                case 'require':
                    arg = (mod && mod.require) || require;
                    break;
                case 'exports':
                    arg = mod.exports;
                    break;
                case 'module':
                    arg = mod;
                    break;
                default:
                    arg = getModExports(id);
            }
            es.push(arg);
        }

        return es;
    }

    function getModExports(id) {
        var mod = mods[id];
        if (!mod) {
            throw new Error('No ' + id);
        }

        if (!mod.defined) {
            var factory = mod.factory;
            var factoryReturn = factory.apply(
                this,
                getModsExports(mod.deps || [], factory, id)
            );
            if (typeof factoryReturn !== 'undefined') {
                mod.exports = factoryReturn;
            }
            mod.defined = 1;
        }

        return mod.exports;
    }
}());
define('echarts', ['echarts/echarts'], function (main) {return main;});
define('echarts/echarts', [
    'require',
    './config',
    'zrender/tool/util',
    'zrender/tool/event',
    'zrender/tool/env',
    'zrender',
    'zrender/config',
    './chart/island',
    './component/toolbox',
    './component',
    './component/title',
    './component/tooltip',
    './component/legend',
    './util/ecData',
    './chart',
    'zrender/tool/color',
    './component/timeline',
    'zrender/shape/Image',
    'zrender/loadingEffect/Bar',
    'zrender/loadingEffect/Bubble',
    'zrender/loadingEffect/DynamicLine',
    'zrender/loadingEffect/Ring',
    'zrender/loadingEffect/Spin',
    'zrender/loadingEffect/Whirling',
    './theme/macarons',
    './theme/infographic'
], function (require) {
    var ecConfig = require('./config');
    var zrUtil = require('zrender/tool/util');
    var zrEvent = require('zrender/tool/event');
    var self = {};
    var _canvasSupported = require('zrender/tool/env').canvasSupported;
    var _idBase = new Date() - 0;
    var _instances = {};
    var DOM_ATTRIBUTE_KEY = '_echarts_instance_';
    self.version = '2.2.1';
    self.dependencies = { zrender: '2.0.8' };
    self.init = function (dom, theme) {
        var zrender = require('zrender');
        if (zrender.version.replace('.', '') - 0 < self.dependencies.zrender.replace('.', '') - 0) {
            console.error('ZRender ' + zrender.version + ' is too old for ECharts ' + self.version + '. Current version need ZRender ' + self.dependencies.zrender + '+');
        }
        dom = dom instanceof Array ? dom[0] : dom;
        var key = dom.getAttribute(DOM_ATTRIBUTE_KEY);
        if (!key) {
            key = _idBase++;
            dom.setAttribute(DOM_ATTRIBUTE_KEY, key);
        }
        if (_instances[key]) {
            _instances[key].dispose();
        }
        _instances[key] = new Echarts(dom);
        _instances[key].id = key;
        _instances[key].canvasSupported = _canvasSupported;
        _instances[key].setTheme(theme);
        return _instances[key];
    };
    self.getInstanceById = function (key) {
        return _instances[key];
    };
    function MessageCenter() {
        zrEvent.Dispatcher.call(this);
    }
    zrUtil.merge(MessageCenter.prototype, zrEvent.Dispatcher.prototype, true);
    function Echarts(dom) {
        dom.innerHTML = '';
        this._themeConfig = {};
        this.dom = dom;
        this._connected = false;
        this._status = {
            dragIn: false,
            dragOut: false,
            needRefresh: false
        };
        this._curEventType = false;
        this._chartList = [];
        this._messageCenter = new MessageCenter();
        this._messageCenterOutSide = new MessageCenter();
        this.resize = this.resize();
        this._init();
    }
    var ZR_EVENT = require('zrender/config').EVENT;
    var ZR_EVENT_LISTENS = [
        'CLICK',
        'DBLCLICK',
        'MOUSEOVER',
        'MOUSEOUT',
        'DRAGSTART',
        'DRAGEND',
        'DRAGENTER',
        'DRAGOVER',
        'DRAGLEAVE',
        'DROP'
    ];
    function callChartListMethodReverse(ecInstance, methodName, arg0, arg1, arg2) {
        var chartList = ecInstance._chartList;
        var len = chartList.length;
        while (len--) {
            var chart = chartList[len];
            if (typeof chart[methodName] === 'function') {
                chart[methodName](arg0, arg1, arg2);
            }
        }
    }
    Echarts.prototype = {
        _init: function () {
            var self = this;
            var _zr = require('zrender').init(this.dom);
            this._zr = _zr;
            this._messageCenter.dispatch = function (type, event, eventPackage, that) {
                eventPackage = eventPackage || {};
                eventPackage.type = type;
                eventPackage.event = event;
                self._messageCenter.dispatchWithContext(type, eventPackage, that);
                if (type != 'HOVER' && type != 'MOUSEOUT') {
                    setTimeout(function () {
                        self._messageCenterOutSide.dispatchWithContext(type, eventPackage, that);
                    }, 50);
                } else {
                    self._messageCenterOutSide.dispatchWithContext(type, eventPackage, that);
                }
            };
            this._onevent = function (param) {
                return self.__onevent(param);
            };
            for (var e in ecConfig.EVENT) {
                if (e != 'CLICK' && e != 'DBLCLICK' && e != 'HOVER' && e != 'MOUSEOUT' && e != 'MAP_ROAM') {
                    this._messageCenter.bind(ecConfig.EVENT[e], this._onevent, this);
                }
            }
            var eventBehaviors = {};
            this._onzrevent = function (param) {
                return self[eventBehaviors[param.type]](param);
            };
            for (var i = 0, len = ZR_EVENT_LISTENS.length; i < len; i++) {
                var eventName = ZR_EVENT_LISTENS[i];
                var eventValue = ZR_EVENT[eventName];
                eventBehaviors[eventValue] = '_on' + eventName.toLowerCase();
                _zr.on(eventValue, this._onzrevent);
            }
            this.chart = {};
            this.component = {};
            var Island = require('./chart/island');
            this._island = new Island(this._themeConfig, this._messageCenter, _zr, {}, this);
            this.chart.island = this._island;
            var Toolbox = require('./component/toolbox');
            this._toolbox = new Toolbox(this._themeConfig, this._messageCenter, _zr, {}, this);
            this.component.toolbox = this._toolbox;
            var componentLibrary = require('./component');
            componentLibrary.define('title', require('./component/title'));
            componentLibrary.define('tooltip', require('./component/tooltip'));
            componentLibrary.define('legend', require('./component/legend'));
            if (_zr.getWidth() === 0 || _zr.getHeight() === 0) {
                console.error('Dom’s width & height should be ready before init.');
            }
        },
        __onevent: function (param) {
            param.__echartsId = param.__echartsId || this.id;
            var fromMyself = param.__echartsId === this.id;
            if (!this._curEventType) {
                this._curEventType = param.type;
            }
            switch (param.type) {
            case ecConfig.EVENT.LEGEND_SELECTED:
                this._onlegendSelected(param);
                break;
            case ecConfig.EVENT.DATA_ZOOM:
                if (!fromMyself) {
                    var dz = this.component.dataZoom;
                    if (dz) {
                        dz.silence(true);
                        dz.absoluteZoom(param.zoom);
                        dz.silence(false);
                    }
                }
                this._ondataZoom(param);
                break;
            case ecConfig.EVENT.DATA_RANGE:
                fromMyself && this._ondataRange(param);
                break;
            case ecConfig.EVENT.MAGIC_TYPE_CHANGED:
                if (!fromMyself) {
                    var tb = this.component.toolbox;
                    if (tb) {
                        tb.silence(true);
                        tb.setMagicType(param.magicType);
                        tb.silence(false);
                    }
                }
                this._onmagicTypeChanged(param);
                break;
            case ecConfig.EVENT.DATA_VIEW_CHANGED:
                fromMyself && this._ondataViewChanged(param);
                break;
            case ecConfig.EVENT.TOOLTIP_HOVER:
                fromMyself && this._tooltipHover(param);
                break;
            case ecConfig.EVENT.RESTORE:
                this._onrestore();
                break;
            case ecConfig.EVENT.REFRESH:
                fromMyself && this._onrefresh(param);
                break;
            case ecConfig.EVENT.TOOLTIP_IN_GRID:
            case ecConfig.EVENT.TOOLTIP_OUT_GRID:
                if (!fromMyself) {
                    var grid = this.component.grid;
                    if (grid) {
                        this._zr.trigger('mousemove', {
                            connectTrigger: true,
                            zrenderX: grid.getX() + param.x * grid.getWidth(),
                            zrenderY: grid.getY() + param.y * grid.getHeight()
                        });
                    }
                } else if (this._connected) {
                    var grid = this.component.grid;
                    if (grid) {
                        param.x = (param.event.zrenderX - grid.getX()) / grid.getWidth();
                        param.y = (param.event.zrenderY - grid.getY()) / grid.getHeight();
                    }
                }
                break;
            }
            if (this._connected && fromMyself && this._curEventType === param.type) {
                for (var c in this._connected) {
                    this._connected[c].connectedEventHandler(param);
                }
                this._curEventType = null;
            }
            if (!fromMyself || !this._connected && fromMyself) {
                this._curEventType = null;
            }
        },
        _onclick: function (param) {
            callChartListMethodReverse(this, 'onclick', param);
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(ecConfig.EVENT.CLICK, param.event, ecData, this);
                }
            }
        },
        _ondblclick: function (param) {
            callChartListMethodReverse(this, 'ondblclick', param);
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(ecConfig.EVENT.DBLCLICK, param.event, ecData, this);
                }
            }
        },
        _onmouseover: function (param) {
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(ecConfig.EVENT.HOVER, param.event, ecData, this);
                }
            }
        },
        _onmouseout: function (param) {
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(ecConfig.EVENT.MOUSEOUT, param.event, ecData, this);
                }
            }
        },
        _ondragstart: function (param) {
            this._status = {
                dragIn: false,
                dragOut: false,
                needRefresh: false
            };
            callChartListMethodReverse(this, 'ondragstart', param);
        },
        _ondragenter: function (param) {
            callChartListMethodReverse(this, 'ondragenter', param);
        },
        _ondragover: function (param) {
            callChartListMethodReverse(this, 'ondragover', param);
        },
        _ondragleave: function (param) {
            callChartListMethodReverse(this, 'ondragleave', param);
        },
        _ondrop: function (param) {
            callChartListMethodReverse(this, 'ondrop', param, this._status);
            this._island.ondrop(param, this._status);
        },
        _ondragend: function (param) {
            callChartListMethodReverse(this, 'ondragend', param, this._status);
            this._timeline && this._timeline.ondragend(param, this._status);
            this._island.ondragend(param, this._status);
            if (this._status.needRefresh) {
                this._syncBackupData(this._option);
                var messageCenter = this._messageCenter;
                messageCenter.dispatch(ecConfig.EVENT.DATA_CHANGED, param.event, this._eventPackage(param.target), this);
                messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },
        _onlegendSelected: function (param) {
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'onlegendSelected', param, this._status);
            if (this._status.needRefresh) {
                this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },
        _ondataZoom: function (param) {
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'ondataZoom', param, this._status);
            if (this._status.needRefresh) {
                this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },
        _ondataRange: function (param) {
            this._clearEffect();
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'ondataRange', param, this._status);
            if (this._status.needRefresh) {
                this._zr.refreshNextFrame();
            }
        },
        _onmagicTypeChanged: function () {
            this._clearEffect();
            this._render(this._toolbox.getMagicOption());
        },
        _ondataViewChanged: function (param) {
            this._syncBackupData(param.option);
            this._messageCenter.dispatch(ecConfig.EVENT.DATA_CHANGED, null, param, this);
            this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
        },
        _tooltipHover: function (param) {
            var tipShape = [];
            callChartListMethodReverse(this, 'ontooltipHover', param, tipShape);
        },
        _onrestore: function () {
            this.restore();
        },
        _onrefresh: function (param) {
            this._refreshInside = true;
            this.refresh(param);
            this._refreshInside = false;
        },
        _syncBackupData: function (curOption) {
            this.component.dataZoom && this.component.dataZoom.syncBackupData(curOption);
        },
        _eventPackage: function (target) {
            if (target) {
                var ecData = require('./util/ecData');
                var seriesIndex = ecData.get(target, 'seriesIndex');
                var dataIndex = ecData.get(target, 'dataIndex');
                dataIndex = seriesIndex != -1 && this.component.dataZoom ? this.component.dataZoom.getRealDataIndex(seriesIndex, dataIndex) : dataIndex;
                return {
                    seriesIndex: seriesIndex,
                    seriesName: (ecData.get(target, 'series') || {}).name,
                    dataIndex: dataIndex,
                    data: ecData.get(target, 'data'),
                    name: ecData.get(target, 'name'),
                    value: ecData.get(target, 'value'),
                    special: ecData.get(target, 'special')
                };
            }
            return;
        },
        _noDataCheck: function (magicOption) {
            var series = magicOption.series;
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type == ecConfig.CHART_TYPE_MAP || series[i].data && series[i].data.length > 0 || series[i].markPoint && series[i].markPoint.data && series[i].markPoint.data.length > 0 || series[i].markLine && series[i].markLine.data && series[i].markLine.data.length > 0 || series[i].nodes && series[i].nodes.length > 0 || series[i].links && series[i].links.length > 0 || series[i].matrix && series[i].matrix.length > 0 || series[i].eventList && series[i].eventList.length > 0) {
                    return false;
                }
            }
            var loadOption = this._option && this._option.noDataLoadingOption || this._themeConfig.noDataLoadingOption || ecConfig.noDataLoadingOption || {
                text: this._option && this._option.noDataText || this._themeConfig.noDataText || ecConfig.noDataText,
                effect: this._option && this._option.noDataEffect || this._themeConfig.noDataEffect || ecConfig.noDataEffect
            };
            this.clear();
            this.showLoading(loadOption);
            return true;
        },
        _render: function (magicOption) {
            this._mergeGlobalConifg(magicOption);
            if (this._noDataCheck(magicOption)) {
                return;
            }
            var bgColor = magicOption.backgroundColor;
            if (bgColor) {
                if (!_canvasSupported && bgColor.indexOf('rgba') != -1) {
                    var cList = bgColor.split(',');
                    this.dom.style.filter = 'alpha(opacity=' + cList[3].substring(0, cList[3].lastIndexOf(')')) * 100 + ')';
                    cList.length = 3;
                    cList[0] = cList[0].replace('a', '');
                    this.dom.style.backgroundColor = cList.join(',') + ')';
                } else {
                    this.dom.style.backgroundColor = bgColor;
                }
            }
            this._zr.clearAnimation();
            this._chartList = [];
            var chartLibrary = require('./chart');
            var componentLibrary = require('./component');
            if (magicOption.xAxis || magicOption.yAxis) {
                magicOption.grid = magicOption.grid || {};
                magicOption.dataZoom = magicOption.dataZoom || {};
            }
            var componentList = [
                'title',
                'legend',
                'tooltip',
                'dataRange',
                'roamController',
                'grid',
                'dataZoom',
                'xAxis',
                'yAxis',
                'polar'
            ];
            var ComponentClass;
            var componentType;
            var component;
            for (var i = 0, l = componentList.length; i < l; i++) {
                componentType = componentList[i];
                component = this.component[componentType];
                if (magicOption[componentType]) {
                    if (component) {
                        component.refresh && component.refresh(magicOption);
                    } else {
                        ComponentClass = componentLibrary.get(/^[xy]Axis$/.test(componentType) ? 'axis' : componentType);
                        component = new ComponentClass(this._themeConfig, this._messageCenter, this._zr, magicOption, this, componentType);
                        this.component[componentType] = component;
                    }
                    this._chartList.push(component);
                } else if (component) {
                    component.dispose();
                    this.component[componentType] = null;
                    delete this.component[componentType];
                }
            }
            var ChartClass;
            var chartType;
            var chart;
            var chartMap = {};
            for (var i = 0, l = magicOption.series.length; i < l; i++) {
                chartType = magicOption.series[i].type;
                if (!chartType) {
                    console.error('series[' + i + '] chart type has not been defined.');
                    continue;
                }
                if (!chartMap[chartType]) {
                    chartMap[chartType] = true;
                    ChartClass = chartLibrary.get(chartType);
                    if (ChartClass) {
                        if (this.chart[chartType]) {
                            chart = this.chart[chartType];
                            chart.refresh(magicOption);
                        } else {
                            chart = new ChartClass(this._themeConfig, this._messageCenter, this._zr, magicOption, this);
                        }
                        this._chartList.push(chart);
                        this.chart[chartType] = chart;
                    } else {
                        console.error(chartType + ' has not been required.');
                    }
                }
            }
            for (chartType in this.chart) {
                if (chartType != ecConfig.CHART_TYPE_ISLAND && !chartMap[chartType]) {
                    this.chart[chartType].dispose();
                    this.chart[chartType] = null;
                    delete this.chart[chartType];
                }
            }
            this.component.grid && this.component.grid.refixAxisShape(this.component);
            this._island.refresh(magicOption);
            this._toolbox.refresh(magicOption);
            magicOption.animation && !magicOption.renderAsImage ? this._zr.refresh() : this._zr.render();
            var imgId = 'IMG' + this.id;
            var img = document.getElementById(imgId);
            if (magicOption.renderAsImage && _canvasSupported) {
                if (img) {
                    img.src = this.getDataURL(magicOption.renderAsImage);
                } else {
                    img = this.getImage(magicOption.renderAsImage);
                    img.id = imgId;
                    img.style.position = 'absolute';
                    img.style.left = 0;
                    img.style.top = 0;
                    this.dom.firstChild.appendChild(img);
                }
                this.un();
                this._zr.un();
                this._disposeChartList();
                this._zr.clear();
            } else if (img) {
                img.parentNode.removeChild(img);
            }
            img = null;
            this._option = magicOption;
        },
        restore: function () {
            this._clearEffect();
            this._option = zrUtil.clone(this._optionRestore);
            this._disposeChartList();
            this._island.clear();
            this._toolbox.reset(this._option, true);
            this._render(this._option);
        },
        refresh: function (param) {
            this._clearEffect();
            param = param || {};
            var magicOption = param.option;
            if (!this._refreshInside && magicOption) {
                magicOption = this.getOption();
                zrUtil.merge(magicOption, param.option, true);
                zrUtil.merge(this._optionRestore, param.option, true);
                this._toolbox.reset(magicOption);
            }
            this._island.refresh(magicOption);
            this._toolbox.refresh(magicOption);
            this._zr.clearAnimation();
            for (var i = 0, l = this._chartList.length; i < l; i++) {
                this._chartList[i].refresh && this._chartList[i].refresh(magicOption);
            }
            this.component.grid && this.component.grid.refixAxisShape(this.component);
            this._zr.refresh();
        },
        _disposeChartList: function () {
            this._clearEffect();
            this._zr.clearAnimation();
            var len = this._chartList.length;
            while (len--) {
                var chart = this._chartList[len];
                if (chart) {
                    var chartType = chart.type;
                    this.chart[chartType] && delete this.chart[chartType];
                    this.component[chartType] && delete this.component[chartType];
                    chart.dispose && chart.dispose();
                }
            }
            this._chartList = [];
        },
        _mergeGlobalConifg: function (magicOption) {
            var mergeList = [
                'backgroundColor',
                'calculable',
                'calculableColor',
                'calculableHolderColor',
                'nameConnector',
                'valueConnector',
                'animation',
                'animationThreshold',
                'animationDuration',
                'animationDurationUpdate',
                'animationEasing',
                'addDataAnimation',
                'symbolList',
                'DRAG_ENABLE_TIME'
            ];
            var len = mergeList.length;
            while (len--) {
                var mergeItem = mergeList[len];
                if (magicOption[mergeItem] == null) {
                    magicOption[mergeItem] = this._themeConfig[mergeItem] != null ? this._themeConfig[mergeItem] : ecConfig[mergeItem];
                }
            }
            var themeColor = magicOption.color;
            if (!(themeColor && themeColor.length)) {
                themeColor = this._themeConfig.color || ecConfig.color;
            }
            this._zr.getColor = function (idx) {
                var zrColor = require('zrender/tool/color');
                return zrColor.getColor(idx, themeColor);
            };
            if (!_canvasSupported) {
                magicOption.animation = false;
                magicOption.addDataAnimation = false;
            }
        },
        setOption: function (option, notMerge) {
            if (!option.timeline) {
                return this._setOption(option, notMerge);
            } else {
                return this._setTimelineOption(option);
            }
        },
        _setOption: function (option, notMerge) {
            if (!notMerge && this._option) {
                this._option = zrUtil.merge(this.getOption(), zrUtil.clone(option), true);
            } else {
                this._option = zrUtil.clone(option);
            }
            this._optionRestore = zrUtil.clone(this._option);
            if (!this._option.series || this._option.series.length === 0) {
                this._zr.clear();
                return;
            }
            if (this.component.dataZoom && (this._option.dataZoom || this._option.toolbox && this._option.toolbox.feature && this._option.toolbox.feature.dataZoom && this._option.toolbox.feature.dataZoom.show)) {
                this.component.dataZoom.syncOption(this._option);
            }
            this._toolbox.reset(this._option);
            this._render(this._option);
            return this;
        },
        getOption: function () {
            var magicOption = zrUtil.clone(this._option);
            var self = this;
            function restoreOption(prop) {
                var restoreSource = self._optionRestore[prop];
                if (restoreSource) {
                    if (restoreSource instanceof Array) {
                        var len = restoreSource.length;
                        while (len--) {
                            magicOption[prop][len].data = zrUtil.clone(restoreSource[len].data);
                        }
                    } else {
                        magicOption[prop].data = zrUtil.clone(restoreSource.data);
                    }
                }
            }
            restoreOption('xAxis');
            restoreOption('yAxis');
            restoreOption('series');
            return magicOption;
        },
        setSeries: function (series, notMerge) {
            if (!notMerge) {
                this.setOption({ series: series });
            } else {
                this._option.series = series;
                this.setOption(this._option, notMerge);
            }
            return this;
        },
        getSeries: function () {
            return this.getOption().series;
        },
        _setTimelineOption: function (option) {
            this._timeline && this._timeline.dispose();
            var Timeline = require('./component/timeline');
            var timeline = new Timeline(this._themeConfig, this._messageCenter, this._zr, option, this);
            this._timeline = timeline;
            this.component.timeline = this._timeline;
            return this;
        },
        addData: function (seriesIdx, data, isHead, dataGrow, additionData) {
            var params = seriesIdx instanceof Array ? seriesIdx : [[
                    seriesIdx,
                    data,
                    isHead,
                    dataGrow,
                    additionData
                ]];
            var magicOption = this.getOption();
            var optionRestore = this._optionRestore;
            for (var i = 0, l = params.length; i < l; i++) {
                seriesIdx = params[i][0];
                data = params[i][1];
                isHead = params[i][2];
                dataGrow = params[i][3];
                additionData = params[i][4];
                var seriesItem = optionRestore.series[seriesIdx];
                var inMethod = isHead ? 'unshift' : 'push';
                var outMethod = isHead ? 'pop' : 'shift';
                if (seriesItem) {
                    var seriesItemData = seriesItem.data;
                    var mSeriesItemData = magicOption.series[seriesIdx].data;
                    seriesItemData[inMethod](data);
                    mSeriesItemData[inMethod](data);
                    if (!dataGrow) {
                        seriesItemData[outMethod]();
                        data = mSeriesItemData[outMethod]();
                    }
                    if (additionData != null) {
                        var legend;
                        var legendData;
                        if (seriesItem.type === ecConfig.CHART_TYPE_PIE && (legend = optionRestore.legend) && (legendData = legend.data)) {
                            var mLegendData = magicOption.legend.data;
                            legendData[inMethod](additionData);
                            mLegendData[inMethod](additionData);
                            if (!dataGrow) {
                                var legendDataIdx = zrUtil.indexOf(legendData, data.name);
                                legendDataIdx != -1 && legendData.splice(legendDataIdx, 1);
                                legendDataIdx = zrUtil.indexOf(mLegendData, data.name);
                                legendDataIdx != -1 && mLegendData.splice(legendDataIdx, 1);
                            }
                        } else if (optionRestore.xAxis != null && optionRestore.yAxis != null) {
                            var axisData;
                            var mAxisData;
                            var axisIdx = seriesItem.xAxisIndex || 0;
                            if (optionRestore.xAxis[axisIdx].type == null || optionRestore.xAxis[axisIdx].type === 'category') {
                                axisData = optionRestore.xAxis[axisIdx].data;
                                mAxisData = magicOption.xAxis[axisIdx].data;
                                axisData[inMethod](additionData);
                                mAxisData[inMethod](additionData);
                                if (!dataGrow) {
                                    axisData[outMethod]();
                                    mAxisData[outMethod]();
                                }
                            }
                            axisIdx = seriesItem.yAxisIndex || 0;
                            if (optionRestore.yAxis[axisIdx].type === 'category') {
                                axisData = optionRestore.yAxis[axisIdx].data;
                                mAxisData = magicOption.yAxis[axisIdx].data;
                                axisData[inMethod](additionData);
                                mAxisData[inMethod](additionData);
                                if (!dataGrow) {
                                    axisData[outMethod]();
                                    mAxisData[outMethod]();
                                }
                            }
                        }
                    }
                    this._option.series[seriesIdx].data = magicOption.series[seriesIdx].data;
                }
            }
            this._zr.clearAnimation();
            var chartList = this._chartList;
            var chartAnimationCount = 0;
            var chartAnimationDone = function () {
                chartAnimationCount--;
                if (chartAnimationCount === 0) {
                    animationDone();
                }
            };
            for (var i = 0, l = chartList.length; i < l; i++) {
                if (magicOption.addDataAnimation && chartList[i].addDataAnimation) {
                    chartAnimationCount++;
                    chartList[i].addDataAnimation(params, chartAnimationDone);
                }
            }
            this.component.dataZoom && this.component.dataZoom.syncOption(magicOption);
            this._option = magicOption;
            var self = this;
            function animationDone() {
                if (!self._zr) {
                    return;
                }
                self._zr.clearAnimation();
                for (var i = 0, l = chartList.length; i < l; i++) {
                    chartList[i].motionlessOnce = magicOption.addDataAnimation && chartList[i].addDataAnimation;
                }
                self._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, { option: magicOption }, self);
            }
            if (!magicOption.addDataAnimation) {
                setTimeout(animationDone, 0);
            }
            return this;
        },
        addMarkPoint: function (seriesIdx, markData) {
            return this._addMark(seriesIdx, markData, 'markPoint');
        },
        addMarkLine: function (seriesIdx, markData) {
            return this._addMark(seriesIdx, markData, 'markLine');
        },
        _addMark: function (seriesIdx, markData, markType) {
            var series = this._option.series;
            var seriesItem;
            if (series && (seriesItem = series[seriesIdx])) {
                var seriesR = this._optionRestore.series;
                var seriesRItem = seriesR[seriesIdx];
                var markOpt = seriesItem[markType];
                var markOptR = seriesRItem[markType];
                markOpt = seriesItem[markType] = markOpt || { data: [] };
                markOptR = seriesRItem[markType] = markOptR || { data: [] };
                for (var key in markData) {
                    if (key === 'data') {
                        markOpt.data = markOpt.data.concat(markData.data);
                        markOptR.data = markOptR.data.concat(markData.data);
                    } else if (typeof markData[key] != 'object' || markOpt[key] == null) {
                        markOpt[key] = markOptR[key] = markData[key];
                    } else {
                        zrUtil.merge(markOpt[key], markData[key], true);
                        zrUtil.merge(markOptR[key], markData[key], true);
                    }
                }
                var chart = this.chart[seriesItem.type];
                chart && chart.addMark(seriesIdx, markData, markType);
            }
            return this;
        },
        delMarkPoint: function (seriesIdx, markName) {
            return this._delMark(seriesIdx, markName, 'markPoint');
        },
        delMarkLine: function (seriesIdx, markName) {
            return this._delMark(seriesIdx, markName, 'markLine');
        },
        _delMark: function (seriesIdx, markName, markType) {
            var series = this._option.series;
            var seriesItem;
            var mark;
            var dataArray;
            if (!(series && (seriesItem = series[seriesIdx]) && (mark = seriesItem[markType]) && (dataArray = mark.data))) {
                return this;
            }
            markName = markName.split(' > ');
            var targetIndex = -1;
            for (var i = 0, l = dataArray.length; i < l; i++) {
                var dataItem = dataArray[i];
                if (dataItem instanceof Array) {
                    if (dataItem[0].name === markName[0] && dataItem[1].name === markName[1]) {
                        targetIndex = i;
                        break;
                    }
                } else if (dataItem.name === markName[0]) {
                    targetIndex = i;
                    break;
                }
            }
            if (targetIndex > -1) {
                dataArray.splice(targetIndex, 1);
                this._optionRestore.series[seriesIdx][markType].data.splice(targetIndex, 1);
                var chart = this.chart[seriesItem.type];
                chart && chart.delMark(seriesIdx, markName.join(' > '), markType);
            }
            return this;
        },
        getDom: function () {
            return this.dom;
        },
        getZrender: function () {
            return this._zr;
        },
        getDataURL: function (imgType) {
            if (!_canvasSupported) {
                return '';
            }
            if (this._chartList.length === 0) {
                var imgId = 'IMG' + this.id;
                var img = document.getElementById(imgId);
                if (img) {
                    return img.src;
                }
            }
            var tooltip = this.component.tooltip;
            tooltip && tooltip.hideTip();
            switch (imgType) {
            case 'jpeg':
                break;
            default:
                imgType = 'png';
            }
            var bgColor = this._option.backgroundColor;
            if (bgColor && bgColor.replace(' ', '') === 'rgba(0,0,0,0)') {
                bgColor = '#fff';
            }
            return this._zr.toDataURL('image/' + imgType, bgColor);
        },
        getImage: function (imgType) {
            var title = this._optionRestore.title;
            var imgDom = document.createElement('img');
            imgDom.src = this.getDataURL(imgType);
            imgDom.title = title && title.text || 'ECharts';
            return imgDom;
        },
        getConnectedDataURL: function (imgType) {
            if (!this.isConnected()) {
                return this.getDataURL(imgType);
            }
            var tempDom = this.dom;
            var imgList = {
                'self': {
                    img: this.getDataURL(imgType),
                    left: tempDom.offsetLeft,
                    top: tempDom.offsetTop,
                    right: tempDom.offsetLeft + tempDom.offsetWidth,
                    bottom: tempDom.offsetTop + tempDom.offsetHeight
                }
            };
            var minLeft = imgList.self.left;
            var minTop = imgList.self.top;
            var maxRight = imgList.self.right;
            var maxBottom = imgList.self.bottom;
            for (var c in this._connected) {
                tempDom = this._connected[c].getDom();
                imgList[c] = {
                    img: this._connected[c].getDataURL(imgType),
                    left: tempDom.offsetLeft,
                    top: tempDom.offsetTop,
                    right: tempDom.offsetLeft + tempDom.offsetWidth,
                    bottom: tempDom.offsetTop + tempDom.offsetHeight
                };
                minLeft = Math.min(minLeft, imgList[c].left);
                minTop = Math.min(minTop, imgList[c].top);
                maxRight = Math.max(maxRight, imgList[c].right);
                maxBottom = Math.max(maxBottom, imgList[c].bottom);
            }
            var zrDom = document.createElement('div');
            zrDom.style.position = 'absolute';
            zrDom.style.left = '-4000px';
            zrDom.style.width = maxRight - minLeft + 'px';
            zrDom.style.height = maxBottom - minTop + 'px';
            document.body.appendChild(zrDom);
            var zrImg = require('zrender').init(zrDom);
            var ImageShape = require('zrender/shape/Image');
            for (var c in imgList) {
                zrImg.addShape(new ImageShape({
                    style: {
                        x: imgList[c].left - minLeft,
                        y: imgList[c].top - minTop,
                        image: imgList[c].img
                    }
                }));
            }
            zrImg.render();
            var bgColor = this._option.backgroundColor;
            if (bgColor && bgColor.replace(/ /g, '') === 'rgba(0,0,0,0)') {
                bgColor = '#fff';
            }
            var image = zrImg.toDataURL('image/png', bgColor);
            setTimeout(function () {
                zrImg.dispose();
                zrDom.parentNode.removeChild(zrDom);
                zrDom = null;
            }, 100);
            return image;
        },
        getConnectedImage: function (imgType) {
            var title = this._optionRestore.title;
            var imgDom = document.createElement('img');
            imgDom.src = this.getConnectedDataURL(imgType);
            imgDom.title = title && title.text || 'ECharts';
            return imgDom;
        },
        on: function (eventName, eventListener) {
            this._messageCenterOutSide.bind(eventName, eventListener, this);
            return this;
        },
        un: function (eventName, eventListener) {
            this._messageCenterOutSide.unbind(eventName, eventListener);
            return this;
        },
        connect: function (connectTarget) {
            if (!connectTarget) {
                return this;
            }
            if (!this._connected) {
                this._connected = {};
            }
            if (connectTarget instanceof Array) {
                for (var i = 0, l = connectTarget.length; i < l; i++) {
                    this._connected[connectTarget[i].id] = connectTarget[i];
                }
            } else {
                this._connected[connectTarget.id] = connectTarget;
            }
            return this;
        },
        disConnect: function (connectTarget) {
            if (!connectTarget || !this._connected) {
                return this;
            }
            if (connectTarget instanceof Array) {
                for (var i = 0, l = connectTarget.length; i < l; i++) {
                    delete this._connected[connectTarget[i].id];
                }
            } else {
                delete this._connected[connectTarget.id];
            }
            for (var k in this._connected) {
                return k, this;
            }
            this._connected = false;
            return this;
        },
        connectedEventHandler: function (param) {
            if (param.__echartsId != this.id) {
                this._onevent(param);
            }
        },
        isConnected: function () {
            return !!this._connected;
        },
        showLoading: function (loadingOption) {
            var effectList = {
                bar: require('zrender/loadingEffect/Bar'),
                bubble: require('zrender/loadingEffect/Bubble'),
                dynamicLine: require('zrender/loadingEffect/DynamicLine'),
                ring: require('zrender/loadingEffect/Ring'),
                spin: require('zrender/loadingEffect/Spin'),
                whirling: require('zrender/loadingEffect/Whirling')
            };
            this._toolbox.hideDataView();
            loadingOption = loadingOption || {};
            var textStyle = loadingOption.textStyle || {};
            loadingOption.textStyle = textStyle;
            var finalTextStyle = zrUtil.merge(zrUtil.merge(zrUtil.clone(textStyle), this._themeConfig.textStyle), ecConfig.textStyle);
            textStyle.textFont = finalTextStyle.fontStyle + ' ' + finalTextStyle.fontWeight + ' ' + finalTextStyle.fontSize + 'px ' + finalTextStyle.fontFamily;
            textStyle.text = loadingOption.text || this._option && this._option.loadingText || this._themeConfig.loadingText || ecConfig.loadingText;
            if (loadingOption.x != null) {
                textStyle.x = loadingOption.x;
            }
            if (loadingOption.y != null) {
                textStyle.y = loadingOption.y;
            }
            loadingOption.effectOption = loadingOption.effectOption || {};
            loadingOption.effectOption.textStyle = textStyle;
            var Effect = loadingOption.effect;
            if (typeof Effect === 'string' || Effect == null) {
                Effect = effectList[loadingOption.effect || this._option && this._option.loadingEffect || this._themeConfig.loadingEffect || ecConfig.loadingEffect] || effectList.spin;
            }
            this._zr.showLoading(new Effect(loadingOption.effectOption));
            return this;
        },
        hideLoading: function () {
            this._zr.hideLoading();
            return this;
        },
        setTheme: function (theme) {
            if (theme) {
                if (typeof theme === 'string') {
                    switch (theme) {
                    case 'macarons':
                        theme = require('./theme/macarons');
                        break;
                    case 'infographic':
                        theme = require('./theme/infographic');
                        break;
                    default:
                        theme = {};
                    }
                } else {
                    theme = theme || {};
                }
                this._themeConfig = theme;
            }
            if (!_canvasSupported) {
                var textStyle = this._themeConfig.textStyle;
                textStyle && textStyle.fontFamily && textStyle.fontFamily2 && (textStyle.fontFamily = textStyle.fontFamily2);
                textStyle = ecConfig.textStyle;
                textStyle.fontFamily = textStyle.fontFamily2;
            }
            this._timeline && this._timeline.setTheme(true);
            this._optionRestore && this.restore();
        },
        resize: function () {
            var self = this;
            return function () {
                self._clearEffect();
                self._zr.resize();
                if (self._option && self._option.renderAsImage && _canvasSupported) {
                    self._render(self._option);
                    return self;
                }
                self._zr.clearAnimation();
                self._island.resize();
                self._toolbox.resize();
                self._timeline && self._timeline.resize();
                for (var i = 0, l = self._chartList.length; i < l; i++) {
                    self._chartList[i].resize && self._chartList[i].resize();
                }
                self.component.grid && self.component.grid.refixAxisShape(self.component);
                self._zr.refresh();
                self._messageCenter.dispatch(ecConfig.EVENT.RESIZE, null, null, self);
                return self;
            };
        },
        _clearEffect: function () {
            this._zr.modLayer(ecConfig.EFFECT_ZLEVEL, { motionBlur: false });
            this._zr.painter.clearLayer(ecConfig.EFFECT_ZLEVEL);
        },
        clear: function () {
            this._disposeChartList();
            this._zr.clear();
            this._option = {};
            this._optionRestore = {};
            this.dom.style.backgroundColor = null;
            return this;
        },
        dispose: function () {
            var key = this.dom.getAttribute(DOM_ATTRIBUTE_KEY);
            key && delete _instances[key];
            this._island.dispose();
            this._toolbox.dispose();
            this._timeline && this._timeline.dispose();
            this._messageCenter.unbind();
            this.clear();
            this._zr.dispose();
            this._zr = null;
        }
    };
    return self;
});define('echarts/config', [], function () {
    var config = {
        CHART_TYPE_LINE: 'line',
        CHART_TYPE_BAR: 'bar',
        CHART_TYPE_SCATTER: 'scatter',
        CHART_TYPE_PIE: 'pie',
        CHART_TYPE_RADAR: 'radar',
        CHART_TYPE_MAP: 'map',
        CHART_TYPE_K: 'k',
        CHART_TYPE_ISLAND: 'island',
        CHART_TYPE_FORCE: 'force',
        CHART_TYPE_CHORD: 'chord',
        CHART_TYPE_GAUGE: 'gauge',
        CHART_TYPE_FUNNEL: 'funnel',
        CHART_TYPE_EVENTRIVER: 'eventRiver',
        COMPONENT_TYPE_TITLE: 'title',
        COMPONENT_TYPE_LEGEND: 'legend',
        COMPONENT_TYPE_DATARANGE: 'dataRange',
        COMPONENT_TYPE_DATAVIEW: 'dataView',
        COMPONENT_TYPE_DATAZOOM: 'dataZoom',
        COMPONENT_TYPE_TOOLBOX: 'toolbox',
        COMPONENT_TYPE_TOOLTIP: 'tooltip',
        COMPONENT_TYPE_GRID: 'grid',
        COMPONENT_TYPE_AXIS: 'axis',
        COMPONENT_TYPE_POLAR: 'polar',
        COMPONENT_TYPE_X_AXIS: 'xAxis',
        COMPONENT_TYPE_Y_AXIS: 'yAxis',
        COMPONENT_TYPE_AXIS_CATEGORY: 'categoryAxis',
        COMPONENT_TYPE_AXIS_VALUE: 'valueAxis',
        COMPONENT_TYPE_TIMELINE: 'timeline',
        COMPONENT_TYPE_ROAMCONTROLLER: 'roamController',
        backgroundColor: 'rgba(0,0,0,0)',
        color: [
            '#ff7f50',
            '#87cefa',
            '#da70d6',
            '#32cd32',
            '#6495ed',
            '#ff69b4',
            '#ba55d3',
            '#cd5c5c',
            '#ffa500',
            '#40e0d0',
            '#1e90ff',
            '#ff6347',
            '#7b68ee',
            '#00fa9a',
            '#ffd700',
            '#6699FF',
            '#ff6666',
            '#3cb371',
            '#b8860b',
            '#30e0e0'
        ],
        markPoint: {
            clickable: true,
            symbol: 'pin',
            symbolSize: 10,
            large: false,
            effect: {
                show: false,
                loop: true,
                period: 15,
                type: 'scale',
                scaleSize: 2,
                bounceDistance: 10
            },
            itemStyle: {
                normal: {
                    borderWidth: 2,
                    label: {
                        show: true,
                        position: 'inside'
                    }
                },
                emphasis: { label: { show: true } }
            }
        },
        markLine: {
            clickable: true,
            symbol: [
                'circle',
                'arrow'
            ],
            symbolSize: [
                2,
                4
            ],
            smoothness: 0.2,
            precision: 2,
            effect: {
                show: false,
                loop: true,
                period: 15,
                scaleSize: 2
            },
            bundling: {
                enable: false,
                maxTurningAngle: 45
            },
            itemStyle: {
                normal: {
                    borderWidth: 1.5,
                    label: {
                        show: true,
                        position: 'end'
                    },
                    lineStyle: { type: 'dashed' }
                },
                emphasis: {
                    label: { show: false },
                    lineStyle: {}
                }
            }
        },
        textStyle: {
            decoration: 'none',
            fontFamily: 'Arial, Verdana, sans-serif',
            fontFamily2: '微软雅黑',
            fontSize: 12,
            fontStyle: 'normal',
            fontWeight: 'normal'
        },
        EVENT: {
            REFRESH: 'refresh',
            RESTORE: 'restore',
            RESIZE: 'resize',
            CLICK: 'click',
            DBLCLICK: 'dblclick',
            HOVER: 'hover',
            MOUSEOUT: 'mouseout',
            DATA_CHANGED: 'dataChanged',
            DATA_ZOOM: 'dataZoom',
            DATA_RANGE: 'dataRange',
            DATA_RANGE_SELECTED: 'dataRangeSelected',
            DATA_RANGE_HOVERLINK: 'dataRangeHoverLink',
            LEGEND_SELECTED: 'legendSelected',
            LEGEND_HOVERLINK: 'legendHoverLink',
            MAP_SELECTED: 'mapSelected',
            PIE_SELECTED: 'pieSelected',
            MAGIC_TYPE_CHANGED: 'magicTypeChanged',
            DATA_VIEW_CHANGED: 'dataViewChanged',
            TIMELINE_CHANGED: 'timelineChanged',
            MAP_ROAM: 'mapRoam',
            FORCE_LAYOUT_END: 'forceLayoutEnd',
            TOOLTIP_HOVER: 'tooltipHover',
            TOOLTIP_IN_GRID: 'tooltipInGrid',
            TOOLTIP_OUT_GRID: 'tooltipOutGrid',
            ROAMCONTROLLER: 'roamController'
        },
        DRAG_ENABLE_TIME: 120,
        EFFECT_ZLEVEL: 10,
        symbolList: [
            'circle',
            'rectangle',
            'triangle',
            'diamond',
            'emptyCircle',
            'emptyRectangle',
            'emptyTriangle',
            'emptyDiamond'
        ],
        loadingEffect: 'spin',
        loadingText: '数据读取中...',
        noDataEffect: 'bubble',
        noDataText: '暂无数据',
        calculable: false,
        calculableColor: 'rgba(255,165,0,0.6)',
        calculableHolderColor: '#ccc',
        nameConnector: ' & ',
        valueConnector: ': ',
        animation: true,
        addDataAnimation: true,
        animationThreshold: 2000,
        animationDuration: 2000,
        animationDurationUpdate: 500,
        animationEasing: 'ExponentialOut'
    };
    return config;
});define('zrender/tool/util', [
    'require',
    '../dep/excanvas'
], function (require) {
    var BUILTIN_OBJECT = {
        '[object Function]': 1,
        '[object RegExp]': 1,
        '[object Date]': 1,
        '[object Error]': 1,
        '[object CanvasGradient]': 1
    };
    var objToString = Object.prototype.toString;
    function isDom(obj) {
        return obj && obj.nodeType === 1 && typeof obj.nodeName == 'string';
    }
    function clone(source) {
        if (typeof source == 'object' && source !== null) {
            var result = source;
            if (source instanceof Array) {
                result = [];
                for (var i = 0, len = source.length; i < len; i++) {
                    result[i] = clone(source[i]);
                }
            } else if (!BUILTIN_OBJECT[objToString.call(source)] && !isDom(source)) {
                result = {};
                for (var key in source) {
                    if (source.hasOwnProperty(key)) {
                        result[key] = clone(source[key]);
                    }
                }
            }
            return result;
        }
        return source;
    }
    function mergeItem(target, source, key, overwrite) {
        if (source.hasOwnProperty(key)) {
            var targetProp = target[key];
            if (typeof targetProp == 'object' && !BUILTIN_OBJECT[objToString.call(targetProp)] && !isDom(targetProp)) {
                merge(target[key], source[key], overwrite);
            } else if (overwrite || !(key in target)) {
                target[key] = source[key];
            }
        }
    }
    function merge(target, source, overwrite) {
        for (var i in source) {
            mergeItem(target, source, i, overwrite);
        }
        return target;
    }
    var _ctx;
    function getContext() {
        if (!_ctx) {
            require('../dep/excanvas');
            if (window['G_vmlCanvasManager']) {
                var _div = document.createElement('div');
                _div.style.position = 'absolute';
                _div.style.top = '-1000px';
                document.body.appendChild(_div);
                _ctx = G_vmlCanvasManager.initElement(_div).getContext('2d');
            } else {
                _ctx = document.createElement('canvas').getContext('2d');
            }
        }
        return _ctx;
    }
    var _canvas;
    var _pixelCtx;
    var _width;
    var _height;
    var _offsetX = 0;
    var _offsetY = 0;
    function getPixelContext() {
        if (!_pixelCtx) {
            _canvas = document.createElement('canvas');
            _width = _canvas.width;
            _height = _canvas.height;
            _pixelCtx = _canvas.getContext('2d');
        }
        return _pixelCtx;
    }
    function adjustCanvasSize(x, y) {
        var _v = 100;
        var _flag;
        if (x + _offsetX > _width) {
            _width = x + _offsetX + _v;
            _canvas.width = _width;
            _flag = true;
        }
        if (y + _offsetY > _height) {
            _height = y + _offsetY + _v;
            _canvas.height = _height;
            _flag = true;
        }
        if (x < -_offsetX) {
            _offsetX = Math.ceil(-x / _v) * _v;
            _width += _offsetX;
            _canvas.width = _width;
            _flag = true;
        }
        if (y < -_offsetY) {
            _offsetY = Math.ceil(-y / _v) * _v;
            _height += _offsetY;
            _canvas.height = _height;
            _flag = true;
        }
        if (_flag) {
            _pixelCtx.translate(_offsetX, _offsetY);
        }
    }
    function getPixelOffset() {
        return {
            x: _offsetX,
            y: _offsetY
        };
    }
    function indexOf(array, value) {
        if (array.indexOf) {
            return array.indexOf(value);
        }
        for (var i = 0, len = array.length; i < len; i++) {
            if (array[i] === value) {
                return i;
            }
        }
        return -1;
    }
    function inherits(clazz, baseClazz) {
        var clazzPrototype = clazz.prototype;
        function F() {
        }
        F.prototype = baseClazz.prototype;
        clazz.prototype = new F();
        for (var prop in clazzPrototype) {
            clazz.prototype[prop] = clazzPrototype[prop];
        }
        clazz.constructor = clazz;
    }
    return {
        inherits: inherits,
        clone: clone,
        merge: merge,
        getContext: getContext,
        getPixelContext: getPixelContext,
        getPixelOffset: getPixelOffset,
        adjustCanvasSize: adjustCanvasSize,
        indexOf: indexOf
    };
});define('zrender/tool/event', [
    'require',
    '../mixin/Eventful'
], function (require) {
    'use strict';
    var Eventful = require('../mixin/Eventful');
    function getX(e) {
        return typeof e.zrenderX != 'undefined' && e.zrenderX || typeof e.offsetX != 'undefined' && e.offsetX || typeof e.layerX != 'undefined' && e.layerX || typeof e.clientX != 'undefined' && e.clientX;
    }
    function getY(e) {
        return typeof e.zrenderY != 'undefined' && e.zrenderY || typeof e.offsetY != 'undefined' && e.offsetY || typeof e.layerY != 'undefined' && e.layerY || typeof e.clientY != 'undefined' && e.clientY;
    }
    function getDelta(e) {
        return typeof e.zrenderDelta != 'undefined' && e.zrenderDelta || typeof e.wheelDelta != 'undefined' && e.wheelDelta || typeof e.detail != 'undefined' && -e.detail;
    }
    var stop = typeof window.addEventListener === 'function' ? function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.cancelBubble = true;
    } : function (e) {
        e.returnValue = false;
        e.cancelBubble = true;
    };
    return {
        getX: getX,
        getY: getY,
        getDelta: getDelta,
        stop: stop,
        Dispatcher: Eventful
    };
});define('zrender/tool/env', [], function () {
    function detect(ua) {
        var os = this.os = {};
        var browser = this.browser = {};
        var webkit = ua.match(/Web[kK]it[\/]{0,1}([\d.]+)/);
        var android = ua.match(/(Android);?[\s\/]+([\d.]+)?/);
        var ipad = ua.match(/(iPad).*OS\s([\d_]+)/);
        var ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
        var iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/);
        var webos = ua.match(/(webOS|hpwOS)[\s\/]([\d.]+)/);
        var touchpad = webos && ua.match(/TouchPad/);
        var kindle = ua.match(/Kindle\/([\d.]+)/);
        var silk = ua.match(/Silk\/([\d._]+)/);
        var blackberry = ua.match(/(BlackBerry).*Version\/([\d.]+)/);
        var bb10 = ua.match(/(BB10).*Version\/([\d.]+)/);
        var rimtabletos = ua.match(/(RIM\sTablet\sOS)\s([\d.]+)/);
        var playbook = ua.match(/PlayBook/);
        var chrome = ua.match(/Chrome\/([\d.]+)/) || ua.match(/CriOS\/([\d.]+)/);
        var firefox = ua.match(/Firefox\/([\d.]+)/);
        var ie = ua.match(/MSIE ([\d.]+)/);
        var safari = webkit && ua.match(/Mobile\//) && !chrome;
        var webview = ua.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/) && !chrome;
        var ie = ua.match(/MSIE\s([\d.]+)/);
        if (browser.webkit = !!webkit)
            browser.version = webkit[1];
        if (android)
            os.android = true, os.version = android[2];
        if (iphone && !ipod)
            os.ios = os.iphone = true, os.version = iphone[2].replace(/_/g, '.');
        if (ipad)
            os.ios = os.ipad = true, os.version = ipad[2].replace(/_/g, '.');
        if (ipod)
            os.ios = os.ipod = true, os.version = ipod[3] ? ipod[3].replace(/_/g, '.') : null;
        if (webos)
            os.webos = true, os.version = webos[2];
        if (touchpad)
            os.touchpad = true;
        if (blackberry)
            os.blackberry = true, os.version = blackberry[2];
        if (bb10)
            os.bb10 = true, os.version = bb10[2];
        if (rimtabletos)
            os.rimtabletos = true, os.version = rimtabletos[2];
        if (playbook)
            browser.playbook = true;
        if (kindle)
            os.kindle = true, os.version = kindle[1];
        if (silk)
            browser.silk = true, browser.version = silk[1];
        if (!silk && os.android && ua.match(/Kindle Fire/))
            browser.silk = true;
        if (chrome)
            browser.chrome = true, browser.version = chrome[1];
        if (firefox)
            browser.firefox = true, browser.version = firefox[1];
        if (ie)
            browser.ie = true, browser.version = ie[1];
        if (safari && (ua.match(/Safari/) || !!os.ios))
            browser.safari = true;
        if (webview)
            browser.webview = true;
        if (ie)
            browser.ie = true, browser.version = ie[1];
        os.tablet = !!(ipad || playbook || android && !ua.match(/Mobile/) || firefox && ua.match(/Tablet/) || ie && !ua.match(/Phone/) && ua.match(/Touch/));
        os.phone = !!(!os.tablet && !os.ipod && (android || iphone || webos || blackberry || bb10 || chrome && ua.match(/Android/) || chrome && ua.match(/CriOS\/([\d.]+)/) || firefox && ua.match(/Mobile/) || ie && ua.match(/Touch/)));
        return {
            browser: browser,
            os: os,
            canvasSupported: document.createElement('canvas').getContext ? true : false
        };
    }
    return detect(navigator.userAgent);
});define('zrender', ['zrender/zrender'], function (main) {return main;});
define('zrender/zrender', [
    'require',
    './dep/excanvas',
    './tool/util',
    './tool/log',
    './tool/guid',
    './Handler',
    './Painter',
    './Storage',
    './animation/Animation',
    './tool/env'
], function (require) {
    require('./dep/excanvas');
    var util = require('./tool/util');
    var log = require('./tool/log');
    var guid = require('./tool/guid');
    var Handler = require('./Handler');
    var Painter = require('./Painter');
    var Storage = require('./Storage');
    var Animation = require('./animation/Animation');
    var _instances = {};
    var zrender = {};
    zrender.version = '2.0.8';
    zrender.init = function (dom) {
        var zr = new ZRender(guid(), dom);
        _instances[zr.id] = zr;
        return zr;
    };
    zrender.dispose = function (zr) {
        if (zr) {
            zr.dispose();
        } else {
            for (var key in _instances) {
                _instances[key].dispose();
            }
            _instances = {};
        }
        return zrender;
    };
    zrender.getInstance = function (id) {
        return _instances[id];
    };
    zrender.delInstance = function (id) {
        delete _instances[id];
        return zrender;
    };
    function getFrameCallback(zrInstance) {
        return function () {
            var animatingElements = zrInstance.animatingElements;
            for (var i = 0, l = animatingElements.length; i < l; i++) {
                zrInstance.storage.mod(animatingElements[i].id);
            }
            if (animatingElements.length || zrInstance._needsRefreshNextFrame) {
                zrInstance.refresh();
            }
        };
    }
    var ZRender = function (id, dom) {
        this.id = id;
        this.env = require('./tool/env');
        this.storage = new Storage();
        this.painter = new Painter(dom, this.storage);
        this.handler = new Handler(dom, this.storage, this.painter);
        this.animatingElements = [];
        this.animation = new Animation({ stage: { update: getFrameCallback(this) } });
        this.animation.start();
        var self = this;
        this.painter.refreshNextFrame = function () {
            self.refreshNextFrame();
        };
        this._needsRefreshNextFrame = false;
        var self = this;
        var storage = this.storage;
        var oldDelFromMap = storage.delFromMap;
        storage.delFromMap = function (elId) {
            var el = storage.get(elId);
            self.stopAnimation(el);
            oldDelFromMap.call(storage, elId);
        };
    };
    ZRender.prototype.getId = function () {
        return this.id;
    };
    ZRender.prototype.addShape = function (shape) {
        this.addElement(shape);
        return this;
    };
    ZRender.prototype.addGroup = function (group) {
        this.addElement(group);
        return this;
    };
    ZRender.prototype.delShape = function (shapeId) {
        this.delElement(shapeId);
        return this;
    };
    ZRender.prototype.delGroup = function (groupId) {
        this.delElement(groupId);
        return this;
    };
    ZRender.prototype.modShape = function (shapeId, shape) {
        this.modElement(shapeId, shape);
        return this;
    };
    ZRender.prototype.modGroup = function (groupId, group) {
        this.modElement(groupId, group);
        return this;
    };
    ZRender.prototype.addElement = function (el) {
        this.storage.addRoot(el);
        this._needsRefreshNextFrame = true;
        return this;
    };
    ZRender.prototype.delElement = function (el) {
        this.storage.delRoot(el);
        this._needsRefreshNextFrame = true;
        return this;
    };
    ZRender.prototype.modElement = function (el, params) {
        this.storage.mod(el, params);
        this._needsRefreshNextFrame = true;
        return this;
    };
    ZRender.prototype.modLayer = function (zLevel, config) {
        this.painter.modLayer(zLevel, config);
        this._needsRefreshNextFrame = true;
        return this;
    };
    ZRender.prototype.addHoverShape = function (shape) {
        this.storage.addHover(shape);
        return this;
    };
    ZRender.prototype.render = function (callback) {
        this.painter.render(callback);
        this._needsRefreshNextFrame = false;
        return this;
    };
    ZRender.prototype.refresh = function (callback) {
        this.painter.refresh(callback);
        this._needsRefreshNextFrame = false;
        return this;
    };
    ZRender.prototype.refreshNextFrame = function () {
        this._needsRefreshNextFrame = true;
        return this;
    };
    ZRender.prototype.refreshHover = function (callback) {
        this.painter.refreshHover(callback);
        return this;
    };
    ZRender.prototype.refreshShapes = function (shapeList, callback) {
        this.painter.refreshShapes(shapeList, callback);
        return this;
    };
    ZRender.prototype.resize = function () {
        this.painter.resize();
        return this;
    };
    ZRender.prototype.animate = function (el, path, loop) {
        if (typeof el === 'string') {
            el = this.storage.get(el);
        }
        if (el) {
            var target;
            if (path) {
                var pathSplitted = path.split('.');
                var prop = el;
                for (var i = 0, l = pathSplitted.length; i < l; i++) {
                    if (!prop) {
                        continue;
                    }
                    prop = prop[pathSplitted[i]];
                }
                if (prop) {
                    target = prop;
                }
            } else {
                target = el;
            }
            if (!target) {
                log('Property "' + path + '" is not existed in element ' + el.id);
                return;
            }
            var animatingElements = this.animatingElements;
            if (el.__animators == null) {
                el.__animators = [];
            }
            var animators = el.__animators;
            if (animators.length === 0) {
                animatingElements.push(el);
            }
            var animator = this.animation.animate(target, { loop: loop }).done(function () {
                var idx = util.indexOf(el.__animators, animator);
                if (idx >= 0) {
                    animators.splice(idx, 1);
                }
                if (animators.length === 0) {
                    var idx = util.indexOf(animatingElements, el);
                    animatingElements.splice(idx, 1);
                }
            });
            animators.push(animator);
            return animator;
        } else {
            log('Element not existed');
        }
    };
    ZRender.prototype.stopAnimation = function (el) {
        if (el.__animators) {
            var animators = el.__animators;
            var len = animators.length;
            for (var i = 0; i < len; i++) {
                animators[i].stop();
            }
            if (len > 0) {
                var animatingElements = this.animatingElements;
                var idx = util.indexOf(animatingElements, el);
                if (idx >= 0) {
                    animatingElements.splice(idx, 1);
                }
            }
            animators.length = 0;
        }
        return this;
    };
    ZRender.prototype.clearAnimation = function () {
        this.animation.clear();
        this.animatingElements.length = 0;
        return this;
    };
    ZRender.prototype.showLoading = function (loadingEffect) {
        this.painter.showLoading(loadingEffect);
        return this;
    };
    ZRender.prototype.hideLoading = function () {
        this.painter.hideLoading();
        return this;
    };
    ZRender.prototype.getWidth = function () {
        return this.painter.getWidth();
    };
    ZRender.prototype.getHeight = function () {
        return this.painter.getHeight();
    };
    ZRender.prototype.toDataURL = function (type, backgroundColor, args) {
        return this.painter.toDataURL(type, backgroundColor, args);
    };
    ZRender.prototype.shapeToImage = function (e, width, height) {
        var id = guid();
        return this.painter.shapeToImage(id, e, width, height);
    };
    ZRender.prototype.on = function (eventName, eventHandler, context) {
        this.handler.on(eventName, eventHandler, context);
        return this;
    };
    ZRender.prototype.un = function (eventName, eventHandler) {
        this.handler.un(eventName, eventHandler);
        return this;
    };
    ZRender.prototype.trigger = function (eventName, event) {
        this.handler.trigger(eventName, event);
        return this;
    };
    ZRender.prototype.clear = function () {
        this.storage.delRoot();
        this.painter.clear();
        return this;
    };
    ZRender.prototype.dispose = function () {
        this.animation.stop();
        this.clear();
        this.storage.dispose();
        this.painter.dispose();
        this.handler.dispose();
        this.animation = this.animatingElements = this.storage = this.painter = this.handler = null;
        zrender.delInstance(this.id);
    };
    return zrender;
});define('zrender/config', [], function () {
    var config = {
        EVENT: {
            RESIZE: 'resize',
            CLICK: 'click',
            DBLCLICK: 'dblclick',
            MOUSEWHEEL: 'mousewheel',
            MOUSEMOVE: 'mousemove',
            MOUSEOVER: 'mouseover',
            MOUSEOUT: 'mouseout',
            MOUSEDOWN: 'mousedown',
            MOUSEUP: 'mouseup',
            GLOBALOUT: 'globalout',
            DRAGSTART: 'dragstart',
            DRAGEND: 'dragend',
            DRAGENTER: 'dragenter',
            DRAGOVER: 'dragover',
            DRAGLEAVE: 'dragleave',
            DROP: 'drop',
            touchClickDelay: 300
        },
        catchBrushException: false,
        debugMode: 0,
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 1)
    };
    return config;
});define('echarts/chart/island', [
    'require',
    './base',
    'zrender/shape/Circle',
    '../config',
    '../util/ecData',
    'zrender/tool/util',
    'zrender/tool/event',
    'zrender/tool/color',
    '../util/accMath',
    '../chart'
], function (require) {
    var ChartBase = require('./base');
    var CircleShape = require('zrender/shape/Circle');
    var ecConfig = require('../config');
    ecConfig.island = {
        zlevel: 0,
        z: 5,
        r: 15,
        calculateStep: 0.1
    };
    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrEvent = require('zrender/tool/event');
    function Island(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        this._nameConnector;
        this._valueConnector;
        this._zrHeight = this.zr.getHeight();
        this._zrWidth = this.zr.getWidth();
        var self = this;
        self.shapeHandler.onmousewheel = function (param) {
            var shape = param.target;
            var event = param.event;
            var delta = zrEvent.getDelta(event);
            delta = delta > 0 ? -1 : 1;
            shape.style.r -= delta;
            shape.style.r = shape.style.r < 5 ? 5 : shape.style.r;
            var value = ecData.get(shape, 'value');
            var dvalue = value * self.option.island.calculateStep;
            value = dvalue > 1 ? Math.round(value - dvalue * delta) : +(value - dvalue * delta).toFixed(2);
            var name = ecData.get(shape, 'name');
            shape.style.text = name + ':' + value;
            ecData.set(shape, 'value', value);
            ecData.set(shape, 'name', name);
            self.zr.modShape(shape.id);
            self.zr.refreshNextFrame();
            zrEvent.stop(event);
        };
    }
    Island.prototype = {
        type: ecConfig.CHART_TYPE_ISLAND,
        _combine: function (tarShape, srcShape) {
            var zrColor = require('zrender/tool/color');
            var accMath = require('../util/accMath');
            var value = accMath.accAdd(ecData.get(tarShape, 'value'), ecData.get(srcShape, 'value'));
            var name = ecData.get(tarShape, 'name') + this._nameConnector + ecData.get(srcShape, 'name');
            tarShape.style.text = name + this._valueConnector + value;
            ecData.set(tarShape, 'value', value);
            ecData.set(tarShape, 'name', name);
            tarShape.style.r = this.option.island.r;
            tarShape.style.color = zrColor.mix(tarShape.style.color, srcShape.style.color);
        },
        refresh: function (newOption) {
            if (newOption) {
                newOption.island = this.reformOption(newOption.island);
                this.option = newOption;
                this._nameConnector = this.option.nameConnector;
                this._valueConnector = this.option.valueConnector;
            }
        },
        getOption: function () {
            return this.option;
        },
        resize: function () {
            var newWidth = this.zr.getWidth();
            var newHieght = this.zr.getHeight();
            var xScale = newWidth / (this._zrWidth || newWidth);
            var yScale = newHieght / (this._zrHeight || newHieght);
            if (xScale === 1 && yScale === 1) {
                return;
            }
            this._zrWidth = newWidth;
            this._zrHeight = newHieght;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.modShape(this.shapeList[i].id, {
                    style: {
                        x: Math.round(this.shapeList[i].style.x * xScale),
                        y: Math.round(this.shapeList[i].style.y * yScale)
                    }
                });
            }
        },
        add: function (shape) {
            var name = ecData.get(shape, 'name');
            var value = ecData.get(shape, 'value');
            var seriesName = ecData.get(shape, 'series') != null ? ecData.get(shape, 'series').name : '';
            var font = this.getFont(this.option.island.textStyle);
            var islandShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: shape.style.x,
                    y: shape.style.y,
                    r: this.option.island.r,
                    color: shape.style.color || shape.style.strokeColor,
                    text: name + this._valueConnector + value,
                    textFont: font
                },
                draggable: true,
                hoverable: true,
                onmousewheel: this.shapeHandler.onmousewheel,
                _type: 'island'
            };
            if (islandShape.style.color === '#fff') {
                islandShape.style.color = shape.style.strokeColor;
            }
            this.setCalculable(islandShape);
            islandShape.dragEnableTime = 0;
            ecData.pack(islandShape, { name: seriesName }, -1, value, -1, name);
            islandShape = new CircleShape(islandShape);
            this.shapeList.push(islandShape);
            this.zr.addShape(islandShape);
        },
        del: function (shape) {
            this.zr.delShape(shape.id);
            var newShapeList = [];
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i].id != shape.id) {
                    newShapeList.push(this.shapeList[i]);
                }
            }
            this.shapeList = newShapeList;
        },
        ondrop: function (param, status) {
            if (!this.isDrop || !param.target) {
                return;
            }
            var target = param.target;
            var dragged = param.dragged;
            this._combine(target, dragged);
            this.zr.modShape(target.id);
            status.dragIn = true;
            this.isDrop = false;
            return;
        },
        ondragend: function (param, status) {
            var target = param.target;
            if (!this.isDragend) {
                if (!status.dragIn) {
                    target.style.x = zrEvent.getX(param.event);
                    target.style.y = zrEvent.getY(param.event);
                    this.add(target);
                    status.needRefresh = true;
                }
            } else {
                if (status.dragIn) {
                    this.del(target);
                    status.needRefresh = true;
                }
            }
            this.isDragend = false;
            return;
        }
    };
    zrUtil.inherits(Island, ChartBase);
    require('../chart').define('island', Island);
    return Island;
});define('echarts/component/toolbox', [
    'require',
    './base',
    'zrender/shape/Line',
    'zrender/shape/Image',
    'zrender/shape/Rectangle',
    '../util/shape/Icon',
    '../config',
    'zrender/tool/util',
    'zrender/config',
    'zrender/tool/event',
    './dataView',
    '../component'
], function (require) {
    var Base = require('./base');
    var LineShape = require('zrender/shape/Line');
    var ImageShape = require('zrender/shape/Image');
    var RectangleShape = require('zrender/shape/Rectangle');
    var IconShape = require('../util/shape/Icon');
    var ecConfig = require('../config');
    ecConfig.toolbox = {
        zlevel: 0,
        z: 6,
        show: false,
        orient: 'horizontal',
        x: 'right',
        y: 'top',
        color: [
            '#1e90ff',
            '#22bb22',
            '#4b0082',
            '#d2691e'
        ],
        disableColor: '#ddd',
        effectiveColor: 'red',
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        itemGap: 10,
        itemSize: 16,
        showTitle: true,
        feature: {
            mark: {
                show: false,
                title: {
                    mark: '辅助线开关',
                    markUndo: '删除辅助线',
                    markClear: '清空辅助线'
                },
                lineStyle: {
                    width: 1,
                    color: '#1e90ff',
                    type: 'dashed'
                }
            },
            dataZoom: {
                show: false,
                title: {
                    dataZoom: '区域缩放',
                    dataZoomReset: '区域缩放后退'
                }
            },
            dataView: {
                show: false,
                title: '数据视图',
                readOnly: false,
                lang: [
                    '数据视图',
                    '关闭',
                    '刷新'
                ]
            },
            magicType: {
                show: false,
                title: {
                    line: '折线图切换',
                    bar: '柱形图切换',
                    stack: '堆积',
                    tiled: '平铺',
                    force: '力导向布局图切换',
                    chord: '和弦图切换',
                    pie: '饼图切换',
                    funnel: '漏斗图切换'
                },
                type: []
            },
            restore: {
                show: false,
                title: '还原'
            },
            saveAsImage: {
                show: false,
                title: '保存为图片',
                type: 'png',
                lang: ['点击保存']
            }
        }
    };
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');
    var _MAGICTYPE_STACK = 'stack';
    var _MAGICTYPE_TILED = 'tiled';
    function Toolbox(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.dom = myChart.dom;
        this._magicType = {};
        this._magicMap = {};
        this._isSilence = false;
        this._iconList;
        this._iconShapeMap = {};
        this._featureTitle = {};
        this._featureIcon = {};
        this._featureColor = {};
        this._featureOption = {};
        this._enableColor = 'red';
        this._disableColor = '#ccc';
        this._markShapeList = [];
        var self = this;
        self._onMark = function (param) {
            self.__onMark(param);
        };
        self._onMarkUndo = function (param) {
            self.__onMarkUndo(param);
        };
        self._onMarkClear = function (param) {
            self.__onMarkClear(param);
        };
        self._onDataZoom = function (param) {
            self.__onDataZoom(param);
        };
        self._onDataZoomReset = function (param) {
            self.__onDataZoomReset(param);
        };
        self._onDataView = function (param) {
            self.__onDataView(param);
        };
        self._onRestore = function (param) {
            self.__onRestore(param);
        };
        self._onSaveAsImage = function (param) {
            self.__onSaveAsImage(param);
        };
        self._onMagicType = function (param) {
            self.__onMagicType(param);
        };
        self._onCustomHandler = function (param) {
            self.__onCustomHandler(param);
        };
        self._onmousemove = function (param) {
            return self.__onmousemove(param);
        };
        self._onmousedown = function (param) {
            return self.__onmousedown(param);
        };
        self._onmouseup = function (param) {
            return self.__onmouseup(param);
        };
        self._onclick = function (param) {
            return self.__onclick(param);
        };
    }
    Toolbox.prototype = {
        type: ecConfig.COMPONENT_TYPE_TOOLBOX,
        _buildShape: function () {
            this._iconList = [];
            var toolboxOption = this.option.toolbox;
            this._enableColor = toolboxOption.effectiveColor;
            this._disableColor = toolboxOption.disableColor;
            var feature = toolboxOption.feature;
            var iconName = [];
            for (var key in feature) {
                if (feature[key].show) {
                    switch (key) {
                    case 'mark':
                        iconName.push({
                            key: key,
                            name: 'mark'
                        });
                        iconName.push({
                            key: key,
                            name: 'markUndo'
                        });
                        iconName.push({
                            key: key,
                            name: 'markClear'
                        });
                        break;
                    case 'magicType':
                        for (var i = 0, l = feature[key].type.length; i < l; i++) {
                            feature[key].title[feature[key].type[i] + 'Chart'] = feature[key].title[feature[key].type[i]];
                            if (feature[key].option) {
                                feature[key].option[feature[key].type[i] + 'Chart'] = feature[key].option[feature[key].type[i]];
                            }
                            iconName.push({
                                key: key,
                                name: feature[key].type[i] + 'Chart'
                            });
                        }
                        break;
                    case 'dataZoom':
                        iconName.push({
                            key: key,
                            name: 'dataZoom'
                        });
                        iconName.push({
                            key: key,
                            name: 'dataZoomReset'
                        });
                        break;
                    case 'saveAsImage':
                        if (this.canvasSupported) {
                            iconName.push({
                                key: key,
                                name: 'saveAsImage'
                            });
                        }
                        break;
                    default:
                        iconName.push({
                            key: key,
                            name: key
                        });
                        break;
                    }
                }
            }
            if (iconName.length > 0) {
                var name;
                var key;
                for (var i = 0, l = iconName.length; i < l; i++) {
                    name = iconName[i].name;
                    key = iconName[i].key;
                    this._iconList.push(name);
                    this._featureTitle[name] = feature[key].title[name] || feature[key].title;
                    if (feature[key].icon) {
                        this._featureIcon[name] = feature[key].icon[name] || feature[key].icon;
                    }
                    if (feature[key].color) {
                        this._featureColor[name] = feature[key].color[name] || feature[key].color;
                    }
                    if (feature[key].option) {
                        this._featureOption[name] = feature[key].option[name] || feature[key].option;
                    }
                }
                this._itemGroupLocation = this._getItemGroupLocation();
                this._buildBackground();
                this._buildItem();
                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    this.zr.addShape(this.shapeList[i]);
                }
                if (this._iconShapeMap['mark']) {
                    this._iconDisable(this._iconShapeMap['markUndo']);
                    this._iconDisable(this._iconShapeMap['markClear']);
                }
                if (this._iconShapeMap['dataZoomReset'] && this._zoomQueue.length === 0) {
                    this._iconDisable(this._iconShapeMap['dataZoomReset']);
                }
            }
        },
        _buildItem: function () {
            var toolboxOption = this.option.toolbox;
            var iconLength = this._iconList.length;
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemSize = toolboxOption.itemSize;
            var itemGap = toolboxOption.itemGap;
            var itemShape;
            var color = toolboxOption.color instanceof Array ? toolboxOption.color : [toolboxOption.color];
            var textFont = this.getFont(toolboxOption.textStyle);
            var textPosition;
            var textAlign;
            var textBaseline;
            if (toolboxOption.orient === 'horizontal') {
                textPosition = this._itemGroupLocation.y / this.zr.getHeight() < 0.5 ? 'bottom' : 'top';
                textAlign = this._itemGroupLocation.x / this.zr.getWidth() < 0.5 ? 'left' : 'right';
                textBaseline = this._itemGroupLocation.y / this.zr.getHeight() < 0.5 ? 'top' : 'bottom';
            } else {
                textPosition = this._itemGroupLocation.x / this.zr.getWidth() < 0.5 ? 'right' : 'left';
            }
            this._iconShapeMap = {};
            var self = this;
            for (var i = 0; i < iconLength; i++) {
                itemShape = {
                    type: 'icon',
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        x: lastX,
                        y: lastY,
                        width: itemSize,
                        height: itemSize,
                        iconType: this._iconList[i],
                        lineWidth: 1,
                        strokeColor: this._featureColor[this._iconList[i]] || color[i % color.length],
                        brushType: 'stroke'
                    },
                    highlightStyle: {
                        lineWidth: 1,
                        text: toolboxOption.showTitle ? this._featureTitle[this._iconList[i]] : undefined,
                        textFont: textFont,
                        textPosition: textPosition,
                        strokeColor: this._featureColor[this._iconList[i]] || color[i % color.length]
                    },
                    hoverable: true,
                    clickable: true
                };
                if (this._featureIcon[this._iconList[i]]) {
                    itemShape.style.image = this._featureIcon[this._iconList[i]].replace(new RegExp('^image:\\/\\/'), '');
                    itemShape.style.opacity = 0.8;
                    itemShape.highlightStyle.opacity = 1;
                    itemShape.type = 'image';
                }
                if (toolboxOption.orient === 'horizontal') {
                    if (i === 0 && textAlign === 'left') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX;
                        itemShape.highlightStyle.textY = textBaseline === 'top' ? lastY + itemSize + 10 : lastY - 10;
                    }
                    if (i === iconLength - 1 && textAlign === 'right') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX + itemSize;
                        itemShape.highlightStyle.textY = textBaseline === 'top' ? lastY + itemSize + 10 : lastY - 10;
                    }
                }
                switch (this._iconList[i]) {
                case 'mark':
                    itemShape.onclick = self._onMark;
                    break;
                case 'markUndo':
                    itemShape.onclick = self._onMarkUndo;
                    break;
                case 'markClear':
                    itemShape.onclick = self._onMarkClear;
                    break;
                case 'dataZoom':
                    itemShape.onclick = self._onDataZoom;
                    break;
                case 'dataZoomReset':
                    itemShape.onclick = self._onDataZoomReset;
                    break;
                case 'dataView':
                    if (!this._dataView) {
                        var DataView = require('./dataView');
                        this._dataView = new DataView(this.ecTheme, this.messageCenter, this.zr, this.option, this.myChart);
                    }
                    itemShape.onclick = self._onDataView;
                    break;
                case 'restore':
                    itemShape.onclick = self._onRestore;
                    break;
                case 'saveAsImage':
                    itemShape.onclick = self._onSaveAsImage;
                    break;
                default:
                    if (this._iconList[i].match('Chart')) {
                        itemShape._name = this._iconList[i].replace('Chart', '');
                        itemShape.onclick = self._onMagicType;
                    } else {
                        itemShape.onclick = self._onCustomHandler;
                    }
                    break;
                }
                if (itemShape.type === 'icon') {
                    itemShape = new IconShape(itemShape);
                } else if (itemShape.type === 'image') {
                    itemShape = new ImageShape(itemShape);
                }
                this.shapeList.push(itemShape);
                this._iconShapeMap[this._iconList[i]] = itemShape;
                if (toolboxOption.orient === 'horizontal') {
                    lastX += itemSize + itemGap;
                } else {
                    lastY += itemSize + itemGap;
                }
            }
        },
        _buildBackground: function () {
            var toolboxOption = this.option.toolbox;
            var padding = this.reformCssArray(this.option.toolbox.padding);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: toolboxOption.borderWidth === 0 ? 'fill' : 'both',
                    color: toolboxOption.backgroundColor,
                    strokeColor: toolboxOption.borderColor,
                    lineWidth: toolboxOption.borderWidth
                }
            }));
        },
        _getItemGroupLocation: function () {
            var toolboxOption = this.option.toolbox;
            var padding = this.reformCssArray(this.option.toolbox.padding);
            var iconLength = this._iconList.length;
            var itemGap = toolboxOption.itemGap;
            var itemSize = toolboxOption.itemSize;
            var totalWidth = 0;
            var totalHeight = 0;
            if (toolboxOption.orient === 'horizontal') {
                totalWidth = (itemSize + itemGap) * iconLength - itemGap;
                totalHeight = itemSize;
            } else {
                totalHeight = (itemSize + itemGap) * iconLength - itemGap;
                totalWidth = itemSize;
            }
            var x;
            var zrWidth = this.zr.getWidth();
            switch (toolboxOption.x) {
            case 'center':
                x = Math.floor((zrWidth - totalWidth) / 2);
                break;
            case 'left':
                x = padding[3] + toolboxOption.borderWidth;
                break;
            case 'right':
                x = zrWidth - totalWidth - padding[1] - toolboxOption.borderWidth;
                break;
            default:
                x = toolboxOption.x - 0;
                x = isNaN(x) ? 0 : x;
                break;
            }
            var y;
            var zrHeight = this.zr.getHeight();
            switch (toolboxOption.y) {
            case 'top':
                y = padding[0] + toolboxOption.borderWidth;
                break;
            case 'bottom':
                y = zrHeight - totalHeight - padding[2] - toolboxOption.borderWidth;
                break;
            case 'center':
                y = Math.floor((zrHeight - totalHeight) / 2);
                break;
            default:
                y = toolboxOption.y - 0;
                y = isNaN(y) ? 0 : y;
                break;
            }
            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight
            };
        },
        __onmousemove: function (param) {
            if (this._marking) {
                this._markShape.style.xEnd = zrEvent.getX(param.event);
                this._markShape.style.yEnd = zrEvent.getY(param.event);
                this.zr.addHoverShape(this._markShape);
            }
            if (this._zooming) {
                this._zoomShape.style.width = zrEvent.getX(param.event) - this._zoomShape.style.x;
                this._zoomShape.style.height = zrEvent.getY(param.event) - this._zoomShape.style.y;
                this.zr.addHoverShape(this._zoomShape);
                this.dom.style.cursor = 'crosshair';
                zrEvent.stop(param.event);
            }
            if (this._zoomStart && (this.dom.style.cursor != 'pointer' && this.dom.style.cursor != 'move')) {
                this.dom.style.cursor = 'crosshair';
            }
        },
        __onmousedown: function (param) {
            if (param.target) {
                return;
            }
            this._zooming = true;
            var x = zrEvent.getX(param.event);
            var y = zrEvent.getY(param.event);
            var zoomOption = this.option.dataZoom || {};
            this._zoomShape = new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y,
                    width: 1,
                    height: 1,
                    brushType: 'both'
                },
                highlightStyle: {
                    lineWidth: 2,
                    color: zoomOption.fillerColor || ecConfig.dataZoom.fillerColor,
                    strokeColor: zoomOption.handleColor || ecConfig.dataZoom.handleColor,
                    brushType: 'both'
                }
            });
            this.zr.addHoverShape(this._zoomShape);
            return true;
        },
        __onmouseup: function () {
            if (!this._zoomShape || Math.abs(this._zoomShape.style.width) < 10 || Math.abs(this._zoomShape.style.height) < 10) {
                this._zooming = false;
                return true;
            }
            if (this._zooming && this.component.dataZoom) {
                this._zooming = false;
                var zoom = this.component.dataZoom.rectZoom(this._zoomShape.style);
                if (zoom) {
                    this._zoomQueue.push({
                        start: zoom.start,
                        end: zoom.end,
                        start2: zoom.start2,
                        end2: zoom.end2
                    });
                    this._iconEnable(this._iconShapeMap['dataZoomReset']);
                    this.zr.refreshNextFrame();
                }
            }
            return true;
        },
        __onclick: function (param) {
            if (param.target) {
                return;
            }
            if (this._marking) {
                this._marking = false;
                this._markShapeList.push(this._markShape);
                this._iconEnable(this._iconShapeMap['markUndo']);
                this._iconEnable(this._iconShapeMap['markClear']);
                this.zr.addShape(this._markShape);
                this.zr.refreshNextFrame();
            } else if (this._markStart) {
                this._marking = true;
                var x = zrEvent.getX(param.event);
                var y = zrEvent.getY(param.event);
                this._markShape = new LineShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        xStart: x,
                        yStart: y,
                        xEnd: x,
                        yEnd: y,
                        lineWidth: this.query(this.option, 'toolbox.feature.mark.lineStyle.width'),
                        strokeColor: this.query(this.option, 'toolbox.feature.mark.lineStyle.color'),
                        lineType: this.query(this.option, 'toolbox.feature.mark.lineStyle.type')
                    }
                });
                this.zr.addHoverShape(this._markShape);
            }
        },
        __onMark: function (param) {
            var target = param.target;
            if (this._marking || this._markStart) {
                this._resetMark();
                this.zr.refreshNextFrame();
            } else {
                this._resetZoom();
                this.zr.modShape(target.id, { style: { strokeColor: this._enableColor } });
                this.zr.refreshNextFrame();
                this._markStart = true;
                var self = this;
                setTimeout(function () {
                    self.zr && self.zr.on(zrConfig.EVENT.CLICK, self._onclick) && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
            }
            return true;
        },
        __onMarkUndo: function () {
            if (this._marking) {
                this._marking = false;
            } else {
                var len = this._markShapeList.length;
                if (len >= 1) {
                    var target = this._markShapeList[len - 1];
                    this.zr.delShape(target.id);
                    this.zr.refreshNextFrame();
                    this._markShapeList.pop();
                    if (len === 1) {
                        this._iconDisable(this._iconShapeMap['markUndo']);
                        this._iconDisable(this._iconShapeMap['markClear']);
                    }
                }
            }
            return true;
        },
        __onMarkClear: function () {
            if (this._marking) {
                this._marking = false;
            }
            var len = this._markShapeList.length;
            if (len > 0) {
                while (len--) {
                    this.zr.delShape(this._markShapeList.pop().id);
                }
                this._iconDisable(this._iconShapeMap['markUndo']);
                this._iconDisable(this._iconShapeMap['markClear']);
                this.zr.refreshNextFrame();
            }
            return true;
        },
        __onDataZoom: function (param) {
            var target = param.target;
            if (this._zooming || this._zoomStart) {
                this._resetZoom();
                this.zr.refreshNextFrame();
                this.dom.style.cursor = 'default';
            } else {
                this._resetMark();
                this.zr.modShape(target.id, { style: { strokeColor: this._enableColor } });
                this.zr.refreshNextFrame();
                this._zoomStart = true;
                var self = this;
                setTimeout(function () {
                    self.zr && self.zr.on(zrConfig.EVENT.MOUSEDOWN, self._onmousedown) && self.zr.on(zrConfig.EVENT.MOUSEUP, self._onmouseup) && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
                this.dom.style.cursor = 'crosshair';
            }
            return true;
        },
        __onDataZoomReset: function () {
            if (this._zooming) {
                this._zooming = false;
            }
            this._zoomQueue.pop();
            if (this._zoomQueue.length > 0) {
                this.component.dataZoom.absoluteZoom(this._zoomQueue[this._zoomQueue.length - 1]);
            } else {
                this.component.dataZoom.rectZoom();
                this._iconDisable(this._iconShapeMap['dataZoomReset']);
                this.zr.refreshNextFrame();
            }
            return true;
        },
        _resetMark: function () {
            this._marking = false;
            if (this._markStart) {
                this._markStart = false;
                if (this._iconShapeMap['mark']) {
                    this.zr.modShape(this._iconShapeMap['mark'].id, { style: { strokeColor: this._iconShapeMap['mark'].highlightStyle.strokeColor } });
                }
                this.zr.un(zrConfig.EVENT.CLICK, this._onclick);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },
        _resetZoom: function () {
            this._zooming = false;
            if (this._zoomStart) {
                this._zoomStart = false;
                if (this._iconShapeMap['dataZoom']) {
                    this.zr.modShape(this._iconShapeMap['dataZoom'].id, { style: { strokeColor: this._iconShapeMap['dataZoom'].highlightStyle.strokeColor } });
                }
                this.zr.un(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
                this.zr.un(zrConfig.EVENT.MOUSEUP, this._onmouseup);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },
        _iconDisable: function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable: false,
                    clickable: false,
                    style: { strokeColor: this._disableColor }
                });
            } else {
                this.zr.modShape(target.id, {
                    hoverable: false,
                    clickable: false,
                    style: { opacity: 0.3 }
                });
            }
        },
        _iconEnable: function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable: true,
                    clickable: true,
                    style: { strokeColor: target.highlightStyle.strokeColor }
                });
            } else {
                this.zr.modShape(target.id, {
                    hoverable: true,
                    clickable: true,
                    style: { opacity: 0.8 }
                });
            }
        },
        __onDataView: function () {
            this._dataView.show(this.option);
            return true;
        },
        __onRestore: function () {
            this._resetMark();
            this._resetZoom();
            this.messageCenter.dispatch(ecConfig.EVENT.RESTORE, null, null, this.myChart);
            return true;
        },
        __onSaveAsImage: function () {
            var saveOption = this.option.toolbox.feature.saveAsImage;
            var imgType = saveOption.type || 'png';
            if (imgType != 'png' && imgType != 'jpeg') {
                imgType = 'png';
            }
            var image;
            if (!this.myChart.isConnected()) {
                image = this.zr.toDataURL('image/' + imgType, this.option.backgroundColor && this.option.backgroundColor.replace(' ', '') === 'rgba(0,0,0,0)' ? '#fff' : this.option.backgroundColor);
            } else {
                image = this.myChart.getConnectedDataURL(imgType);
            }
            var downloadDiv = document.createElement('div');
            downloadDiv.id = '__echarts_download_wrap__';
            downloadDiv.style.cssText = 'position:fixed;' + 'z-index:99999;' + 'display:block;' + 'top:0;left:0;' + 'background-color:rgba(33,33,33,0.5);' + 'text-align:center;' + 'width:100%;' + 'height:100%;' + 'line-height:' + document.documentElement.clientHeight + 'px;';
            var downloadLink = document.createElement('a');
            downloadLink.href = image;
            downloadLink.setAttribute('download', (saveOption.name ? saveOption.name : this.option.title && (this.option.title.text || this.option.title.subtext) ? this.option.title.text || this.option.title.subtext : 'ECharts') + '.' + imgType);
            downloadLink.innerHTML = '<img style="vertical-align:middle" src="' + image + '" title="' + (!!window.ActiveXObject || 'ActiveXObject' in window ? '右键->图片另存为' : saveOption.lang ? saveOption.lang[0] : '点击保存') + '"/>';
            downloadDiv.appendChild(downloadLink);
            document.body.appendChild(downloadDiv);
            downloadLink = null;
            downloadDiv = null;
            setTimeout(function () {
                var _d = document.getElementById('__echarts_download_wrap__');
                if (_d) {
                    _d.onclick = function () {
                        var d = document.getElementById('__echarts_download_wrap__');
                        d.onclick = null;
                        d.innerHTML = '';
                        document.body.removeChild(d);
                        d = null;
                    };
                    _d = null;
                }
            }, 500);
            return;
        },
        __onMagicType: function (param) {
            this._resetMark();
            var itemName = param.target._name;
            if (!this._magicType[itemName]) {
                this._magicType[itemName] = true;
                if (itemName === ecConfig.CHART_TYPE_LINE) {
                    this._magicType[ecConfig.CHART_TYPE_BAR] = false;
                } else if (itemName === ecConfig.CHART_TYPE_BAR) {
                    this._magicType[ecConfig.CHART_TYPE_LINE] = false;
                }
                if (itemName === ecConfig.CHART_TYPE_PIE) {
                    this._magicType[ecConfig.CHART_TYPE_FUNNEL] = false;
                } else if (itemName === ecConfig.CHART_TYPE_FUNNEL) {
                    this._magicType[ecConfig.CHART_TYPE_PIE] = false;
                }
                if (itemName === ecConfig.CHART_TYPE_FORCE) {
                    this._magicType[ecConfig.CHART_TYPE_CHORD] = false;
                } else if (itemName === ecConfig.CHART_TYPE_CHORD) {
                    this._magicType[ecConfig.CHART_TYPE_FORCE] = false;
                }
                if (itemName === _MAGICTYPE_STACK) {
                    this._magicType[_MAGICTYPE_TILED] = false;
                } else if (itemName === _MAGICTYPE_TILED) {
                    this._magicType[_MAGICTYPE_STACK] = false;
                }
                this.messageCenter.dispatch(ecConfig.EVENT.MAGIC_TYPE_CHANGED, param.event, { magicType: this._magicType }, this.myChart);
            }
            return true;
        },
        setMagicType: function (magicType) {
            this._resetMark();
            this._magicType = magicType;
            !this._isSilence && this.messageCenter.dispatch(ecConfig.EVENT.MAGIC_TYPE_CHANGED, null, { magicType: this._magicType }, this.myChart);
        },
        __onCustomHandler: function (param) {
            var target = param.target.style.iconType;
            var featureHandler = this.option.toolbox.feature[target].onclick;
            if (typeof featureHandler === 'function') {
                featureHandler.call(this, this.option);
            }
        },
        reset: function (newOption, isRestore) {
            isRestore && this.clear();
            if (this.query(newOption, 'toolbox.show') && this.query(newOption, 'toolbox.feature.magicType.show')) {
                var magicType = newOption.toolbox.feature.magicType.type;
                var len = magicType.length;
                this._magicMap = {};
                while (len--) {
                    this._magicMap[magicType[len]] = true;
                }
                len = newOption.series.length;
                var oriType;
                var axis;
                while (len--) {
                    oriType = newOption.series[len].type;
                    if (this._magicMap[oriType]) {
                        axis = newOption.xAxis instanceof Array ? newOption.xAxis[newOption.series[len].xAxisIndex || 0] : newOption.xAxis;
                        if (axis && (axis.type || 'category') === 'category') {
                            axis.__boundaryGap = axis.boundaryGap != null ? axis.boundaryGap : true;
                        }
                        axis = newOption.yAxis instanceof Array ? newOption.yAxis[newOption.series[len].yAxisIndex || 0] : newOption.yAxis;
                        if (axis && axis.type === 'category') {
                            axis.__boundaryGap = axis.boundaryGap != null ? axis.boundaryGap : true;
                        }
                        newOption.series[len].__type = oriType;
                        newOption.series[len].__itemStyle = zrUtil.clone(newOption.series[len].itemStyle || {});
                    }
                    if (this._magicMap[_MAGICTYPE_STACK] || this._magicMap[_MAGICTYPE_TILED]) {
                        newOption.series[len].__stack = newOption.series[len].stack;
                    }
                }
            }
            this._magicType = isRestore ? {} : this._magicType || {};
            for (var itemName in this._magicType) {
                if (this._magicType[itemName]) {
                    this.option = newOption;
                    this.getMagicOption();
                    break;
                }
            }
            var zoomOption = newOption.dataZoom;
            if (zoomOption && zoomOption.show) {
                var start = zoomOption.start != null && zoomOption.start >= 0 && zoomOption.start <= 100 ? zoomOption.start : 0;
                var end = zoomOption.end != null && zoomOption.end >= 0 && zoomOption.end <= 100 ? zoomOption.end : 100;
                if (start > end) {
                    start = start + end;
                    end = start - end;
                    start = start - end;
                }
                this._zoomQueue = [{
                        start: start,
                        end: end,
                        start2: 0,
                        end2: 100
                    }];
            } else {
                this._zoomQueue = [];
            }
        },
        getMagicOption: function () {
            var axis;
            var chartType;
            if (this._magicType[ecConfig.CHART_TYPE_LINE] || this._magicType[ecConfig.CHART_TYPE_BAR]) {
                var boundaryGap = this._magicType[ecConfig.CHART_TYPE_LINE] ? false : true;
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    chartType = this.option.series[i].type;
                    if (chartType == ecConfig.CHART_TYPE_LINE || chartType == ecConfig.CHART_TYPE_BAR) {
                        axis = this.option.xAxis instanceof Array ? this.option.xAxis[this.option.series[i].xAxisIndex || 0] : this.option.xAxis;
                        if (axis && (axis.type || 'category') === 'category') {
                            axis.boundaryGap = boundaryGap ? true : axis.__boundaryGap;
                        }
                        axis = this.option.yAxis instanceof Array ? this.option.yAxis[this.option.series[i].yAxisIndex || 0] : this.option.yAxis;
                        if (axis && axis.type === 'category') {
                            axis.boundaryGap = boundaryGap ? true : axis.__boundaryGap;
                        }
                    }
                }
                this._defaultMagic(ecConfig.CHART_TYPE_LINE, ecConfig.CHART_TYPE_BAR);
            }
            this._defaultMagic(ecConfig.CHART_TYPE_CHORD, ecConfig.CHART_TYPE_FORCE);
            this._defaultMagic(ecConfig.CHART_TYPE_PIE, ecConfig.CHART_TYPE_FUNNEL);
            if (this._magicType[_MAGICTYPE_STACK] || this._magicType[_MAGICTYPE_TILED]) {
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    if (this._magicType[_MAGICTYPE_STACK]) {
                        this.option.series[i].stack = '_ECHARTS_STACK_KENER_2014_';
                        chartType = _MAGICTYPE_STACK;
                    } else if (this._magicType[_MAGICTYPE_TILED]) {
                        this.option.series[i].stack = null;
                        chartType = _MAGICTYPE_TILED;
                    }
                    if (this._featureOption[chartType + 'Chart']) {
                        zrUtil.merge(this.option.series[i], this._featureOption[chartType + 'Chart'] || {}, true);
                    }
                }
            }
            return this.option;
        },
        _defaultMagic: function (cType1, cType2) {
            if (this._magicType[cType1] || this._magicType[cType2]) {
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    var chartType = this.option.series[i].type;
                    if (chartType == cType1 || chartType == cType2) {
                        this.option.series[i].type = this._magicType[cType1] ? cType1 : cType2;
                        this.option.series[i].itemStyle = zrUtil.clone(this.option.series[i].__itemStyle);
                        chartType = this.option.series[i].type;
                        if (this._featureOption[chartType + 'Chart']) {
                            zrUtil.merge(this.option.series[i], this._featureOption[chartType + 'Chart'] || {}, true);
                        }
                    }
                }
            }
        },
        silence: function (s) {
            this._isSilence = s;
        },
        resize: function () {
            this._resetMark();
            this.clear();
            if (this.option && this.option.toolbox && this.option.toolbox.show) {
                this._buildShape();
            }
            if (this._dataView) {
                this._dataView.resize();
            }
        },
        hideDataView: function () {
            if (this._dataView) {
                this._dataView.hide();
            }
        },
        clear: function (notMark) {
            if (this.zr) {
                this.zr.delShape(this.shapeList);
                this.shapeList = [];
                if (!notMark) {
                    this.zr.delShape(this._markShapeList);
                    this._markShapeList = [];
                }
            }
        },
        onbeforDispose: function () {
            if (this._dataView) {
                this._dataView.dispose();
                this._dataView = null;
            }
            this._markShapeList = null;
        },
        refresh: function (newOption) {
            if (newOption) {
                this._resetMark();
                this._resetZoom();
                newOption.toolbox = this.reformOption(newOption.toolbox);
                this.option = newOption;
                this.clear(true);
                if (newOption.toolbox.show) {
                    this._buildShape();
                }
                this.hideDataView();
            }
        }
    };
    zrUtil.inherits(Toolbox, Base);
    require('../component').define('toolbox', Toolbox);
    return Toolbox;
});define('echarts/component', [], function () {
    var self = {};
    var _componentLibrary = {};
    self.define = function (name, clazz) {
        _componentLibrary[name] = clazz;
        return self;
    };
    self.get = function (name) {
        return _componentLibrary[name];
    };
    return self;
});define('echarts/component/title', [
    'require',
    './base',
    'zrender/shape/Text',
    'zrender/shape/Rectangle',
    '../config',
    'zrender/tool/util',
    'zrender/tool/area',
    'zrender/tool/color',
    '../component'
], function (require) {
    var Base = require('./base');
    var TextShape = require('zrender/shape/Text');
    var RectangleShape = require('zrender/shape/Rectangle');
    var ecConfig = require('../config');
    ecConfig.title = {
        zlevel: 0,
        z: 6,
        show: true,
        text: '',
        subtext: '',
        x: 'left',
        y: 'top',
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        itemGap: 5,
        textStyle: {
            fontSize: 18,
            fontWeight: 'bolder',
            color: '#333'
        },
        subtextStyle: { color: '#aaa' }
    };
    var zrUtil = require('zrender/tool/util');
    var zrArea = require('zrender/tool/area');
    var zrColor = require('zrender/tool/color');
    function Title(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.refresh(option);
    }
    Title.prototype = {
        type: ecConfig.COMPONENT_TYPE_TITLE,
        _buildShape: function () {
            if (!this.titleOption.show) {
                return;
            }
            this._itemGroupLocation = this._getItemGroupLocation();
            this._buildBackground();
            this._buildItem();
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },
        _buildItem: function () {
            var text = this.titleOption.text;
            var link = this.titleOption.link;
            var target = this.titleOption.target;
            var subtext = this.titleOption.subtext;
            var sublink = this.titleOption.sublink;
            var subtarget = this.titleOption.subtarget;
            var font = this.getFont(this.titleOption.textStyle);
            var subfont = this.getFont(this.titleOption.subtextStyle);
            var x = this._itemGroupLocation.x;
            var y = this._itemGroupLocation.y;
            var width = this._itemGroupLocation.width;
            var height = this._itemGroupLocation.height;
            var textShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    y: y,
                    color: this.titleOption.textStyle.color,
                    text: text,
                    textFont: font,
                    textBaseline: 'top'
                },
                highlightStyle: {
                    color: zrColor.lift(this.titleOption.textStyle.color, 1),
                    brushType: 'fill'
                },
                hoverable: false
            };
            if (link) {
                textShape.hoverable = true;
                textShape.clickable = true;
                textShape.onclick = function () {
                    if (!target || target != 'self') {
                        window.open(link);
                    } else {
                        window.location = link;
                    }
                };
            }
            var subtextShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    y: y + height,
                    color: this.titleOption.subtextStyle.color,
                    text: subtext,
                    textFont: subfont,
                    textBaseline: 'bottom'
                },
                highlightStyle: {
                    color: zrColor.lift(this.titleOption.subtextStyle.color, 1),
                    brushType: 'fill'
                },
                hoverable: false
            };
            if (sublink) {
                subtextShape.hoverable = true;
                subtextShape.clickable = true;
                subtextShape.onclick = function () {
                    if (!subtarget || subtarget != 'self') {
                        window.open(sublink);
                    } else {
                        window.location = sublink;
                    }
                };
            }
            switch (this.titleOption.x) {
            case 'center':
                textShape.style.x = subtextShape.style.x = x + width / 2;
                textShape.style.textAlign = subtextShape.style.textAlign = 'center';
                break;
            case 'left':
                textShape.style.x = subtextShape.style.x = x;
                textShape.style.textAlign = subtextShape.style.textAlign = 'left';
                break;
            case 'right':
                textShape.style.x = subtextShape.style.x = x + width;
                textShape.style.textAlign = subtextShape.style.textAlign = 'right';
                break;
            default:
                x = this.titleOption.x - 0;
                x = isNaN(x) ? 0 : x;
                textShape.style.x = subtextShape.style.x = x;
                break;
            }
            if (this.titleOption.textAlign) {
                textShape.style.textAlign = subtextShape.style.textAlign = this.titleOption.textAlign;
            }
            this.shapeList.push(new TextShape(textShape));
            subtext !== '' && this.shapeList.push(new TextShape(subtextShape));
        },
        _buildBackground: function () {
            var padding = this.reformCssArray(this.titleOption.padding);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.titleOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.titleOption.backgroundColor,
                    strokeColor: this.titleOption.borderColor,
                    lineWidth: this.titleOption.borderWidth
                }
            }));
        },
        _getItemGroupLocation: function () {
            var padding = this.reformCssArray(this.titleOption.padding);
            var text = this.titleOption.text;
            var subtext = this.titleOption.subtext;
            var font = this.getFont(this.titleOption.textStyle);
            var subfont = this.getFont(this.titleOption.subtextStyle);
            var totalWidth = Math.max(zrArea.getTextWidth(text, font), zrArea.getTextWidth(subtext, subfont));
            var totalHeight = zrArea.getTextHeight(text, font) + (subtext === '' ? 0 : this.titleOption.itemGap + zrArea.getTextHeight(subtext, subfont));
            var x;
            var zrWidth = this.zr.getWidth();
            switch (this.titleOption.x) {
            case 'center':
                x = Math.floor((zrWidth - totalWidth) / 2);
                break;
            case 'left':
                x = padding[3] + this.titleOption.borderWidth;
                break;
            case 'right':
                x = zrWidth - totalWidth - padding[1] - this.titleOption.borderWidth;
                break;
            default:
                x = this.titleOption.x - 0;
                x = isNaN(x) ? 0 : x;
                break;
            }
            var y;
            var zrHeight = this.zr.getHeight();
            switch (this.titleOption.y) {
            case 'top':
                y = padding[0] + this.titleOption.borderWidth;
                break;
            case 'bottom':
                y = zrHeight - totalHeight - padding[2] - this.titleOption.borderWidth;
                break;
            case 'center':
                y = Math.floor((zrHeight - totalHeight) / 2);
                break;
            default:
                y = this.titleOption.y - 0;
                y = isNaN(y) ? 0 : y;
                break;
            }
            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight
            };
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.option.title = this.reformOption(this.option.title);
                this.titleOption = this.option.title;
                this.titleOption.textStyle = this.getTextStyle(this.titleOption.textStyle);
                this.titleOption.subtextStyle = this.getTextStyle(this.titleOption.subtextStyle);
            }
            this.clear();
            this._buildShape();
        }
    };
    zrUtil.inherits(Title, Base);
    require('../component').define('title', Title);
    return Title;
});define('echarts/component/tooltip', [
    'require',
    './base',
    '../util/shape/Cross',
    'zrender/shape/Line',
    'zrender/shape/Rectangle',
    '../config',
    '../util/ecData',
    'zrender/config',
    'zrender/tool/event',
    'zrender/tool/area',
    'zrender/tool/color',
    'zrender/tool/util',
    'zrender/shape/Base',
    '../component'
], function (require) {
    var Base = require('./base');
    var CrossShape = require('../util/shape/Cross');
    var LineShape = require('zrender/shape/Line');
    var RectangleShape = require('zrender/shape/Rectangle');
    var rectangleInstance = new RectangleShape({});
    var ecConfig = require('../config');
    ecConfig.tooltip = {
        zlevel: 1,
        z: 8,
        show: true,
        showContent: true,
        trigger: 'item',
        islandFormatter: '{a} <br/>{b} : {c}',
        showDelay: 20,
        hideDelay: 100,
        transitionDuration: 0.4,
        enterable: false,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderColor: '#333',
        borderRadius: 4,
        borderWidth: 0,
        padding: 5,
        axisPointer: {
            type: 'line',
            lineStyle: {
                color: '#48b',
                width: 2,
                type: 'solid'
            },
            crossStyle: {
                color: '#1e90ff',
                width: 1,
                type: 'dashed'
            },
            shadowStyle: {
                color: 'rgba(150,150,150,0.3)',
                width: 'auto',
                type: 'default'
            }
        },
        textStyle: { color: '#fff' }
    };
    var ecData = require('../util/ecData');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');
    var zrArea = require('zrender/tool/area');
    var zrColor = require('zrender/tool/color');
    var zrUtil = require('zrender/tool/util');
    var zrShapeBase = require('zrender/shape/Base');
    function Tooltip(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.dom = myChart.dom;
        var self = this;
        self._onmousemove = function (param) {
            return self.__onmousemove(param);
        };
        self._onglobalout = function (param) {
            return self.__onglobalout(param);
        };
        this.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
        this.zr.on(zrConfig.EVENT.GLOBALOUT, self._onglobalout);
        self._hide = function (param) {
            return self.__hide(param);
        };
        self._tryShow = function (param) {
            return self.__tryShow(param);
        };
        self._refixed = function (param) {
            return self.__refixed(param);
        };
        self._setContent = function (ticket, res) {
            return self.__setContent(ticket, res);
        };
        this._tDom = this._tDom || document.createElement('div');
        this._tDom.onselectstart = function () {
            return false;
        };
        this._tDom.onmouseover = function () {
            self._mousein = true;
        };
        this._tDom.onmouseout = function () {
            self._mousein = false;
        };
        this._tDom.className = 'echarts-tooltip';
        this._tDom.style.position = 'absolute';
        this.hasAppend = false;
        this._axisLineShape && this.zr.delShape(this._axisLineShape.id);
        this._axisLineShape = new LineShape({
            zlevel: this.getZlevelBase(),
            z: this.getZBase(),
            invisible: true,
            hoverable: false
        });
        this.shapeList.push(this._axisLineShape);
        this.zr.addShape(this._axisLineShape);
        this._axisShadowShape && this.zr.delShape(this._axisShadowShape.id);
        this._axisShadowShape = new LineShape({
            zlevel: this.getZlevelBase(),
            z: 1,
            invisible: true,
            hoverable: false
        });
        this.shapeList.push(this._axisShadowShape);
        this.zr.addShape(this._axisShadowShape);
        this._axisCrossShape && this.zr.delShape(this._axisCrossShape.id);
        this._axisCrossShape = new CrossShape({
            zlevel: this.getZlevelBase(),
            z: this.getZBase(),
            invisible: true,
            hoverable: false
        });
        this.shapeList.push(this._axisCrossShape);
        this.zr.addShape(this._axisCrossShape);
        this.showing = false;
        this.refresh(option);
    }
    Tooltip.prototype = {
        type: ecConfig.COMPONENT_TYPE_TOOLTIP,
        _gCssText: 'position:absolute;display:block;border-style:solid;white-space:nowrap;',
        _style: function (opt) {
            if (!opt) {
                return '';
            }
            var cssText = [];
            if (opt.transitionDuration) {
                var transitionText = 'left ' + opt.transitionDuration + 's,' + 'top ' + opt.transitionDuration + 's';
                cssText.push('transition:' + transitionText);
                cssText.push('-moz-transition:' + transitionText);
                cssText.push('-webkit-transition:' + transitionText);
                cssText.push('-o-transition:' + transitionText);
            }
            if (opt.backgroundColor) {
                cssText.push('background-Color:' + zrColor.toHex(opt.backgroundColor));
                cssText.push('filter:alpha(opacity=70)');
                cssText.push('background-Color:' + opt.backgroundColor);
            }
            if (opt.borderWidth != null) {
                cssText.push('border-width:' + opt.borderWidth + 'px');
            }
            if (opt.borderColor != null) {
                cssText.push('border-color:' + opt.borderColor);
            }
            if (opt.borderRadius != null) {
                cssText.push('border-radius:' + opt.borderRadius + 'px');
                cssText.push('-moz-border-radius:' + opt.borderRadius + 'px');
                cssText.push('-webkit-border-radius:' + opt.borderRadius + 'px');
                cssText.push('-o-border-radius:' + opt.borderRadius + 'px');
            }
            var textStyle = opt.textStyle;
            if (textStyle) {
                textStyle.color && cssText.push('color:' + textStyle.color);
                textStyle.decoration && cssText.push('text-decoration:' + textStyle.decoration);
                textStyle.align && cssText.push('text-align:' + textStyle.align);
                textStyle.fontFamily && cssText.push('font-family:' + textStyle.fontFamily);
                textStyle.fontSize && cssText.push('font-size:' + textStyle.fontSize + 'px');
                textStyle.fontSize && cssText.push('line-height:' + Math.round(textStyle.fontSize * 3 / 2) + 'px');
                textStyle.fontStyle && cssText.push('font-style:' + textStyle.fontStyle);
                textStyle.fontWeight && cssText.push('font-weight:' + textStyle.fontWeight);
            }
            var padding = opt.padding;
            if (padding != null) {
                padding = this.reformCssArray(padding);
                cssText.push('padding:' + padding[0] + 'px ' + padding[1] + 'px ' + padding[2] + 'px ' + padding[3] + 'px');
            }
            cssText = cssText.join(';') + ';';
            return cssText;
        },
        __hide: function () {
            this._lastDataIndex = -1;
            this._lastSeriesIndex = -1;
            this._lastItemTriggerId = -1;
            if (this._tDom) {
                this._tDom.style.display = 'none';
            }
            var needRefresh = false;
            if (!this._axisLineShape.invisible) {
                this._axisLineShape.invisible = true;
                this.zr.modShape(this._axisLineShape.id);
                needRefresh = true;
            }
            if (!this._axisShadowShape.invisible) {
                this._axisShadowShape.invisible = true;
                this.zr.modShape(this._axisShadowShape.id);
                needRefresh = true;
            }
            if (!this._axisCrossShape.invisible) {
                this._axisCrossShape.invisible = true;
                this.zr.modShape(this._axisCrossShape.id);
                needRefresh = true;
            }
            if (this._lastTipShape && this._lastTipShape.tipShape.length > 0) {
                this.zr.delShape(this._lastTipShape.tipShape);
                this._lastTipShape = false;
                this.shapeList.length = 2;
            }
            needRefresh && this.zr.refreshNextFrame();
            this.showing = false;
        },
        _show: function (position, x, y, specialCssText) {
            var domHeight = this._tDom.offsetHeight;
            var domWidth = this._tDom.offsetWidth;
            if (position) {
                if (typeof position === 'function') {
                    position = position([
                        x,
                        y
                    ]);
                }
                if (position instanceof Array) {
                    x = position[0];
                    y = position[1];
                }
            }
            if (x + domWidth > this._zrWidth) {
                x -= domWidth + 40;
            }
            if (y + domHeight > this._zrHeight) {
                y -= domHeight - 20;
            }
            if (y < 20) {
                y = 0;
            }
            this._tDom.style.cssText = this._gCssText + this._defaultCssText + (specialCssText ? specialCssText : '') + 'left:' + x + 'px;top:' + y + 'px;';
            if (domHeight < 10 || domWidth < 10) {
                setTimeout(this._refixed, 20);
            }
            this.showing = true;
        },
        __refixed: function () {
            if (this._tDom) {
                var cssText = '';
                var domHeight = this._tDom.offsetHeight;
                var domWidth = this._tDom.offsetWidth;
                if (this._tDom.offsetLeft + domWidth > this._zrWidth) {
                    cssText += 'left:' + (this._zrWidth - domWidth - 20) + 'px;';
                }
                if (this._tDom.offsetTop + domHeight > this._zrHeight) {
                    cssText += 'top:' + (this._zrHeight - domHeight - 10) + 'px;';
                }
                if (cssText !== '') {
                    this._tDom.style.cssText += cssText;
                }
            }
        },
        __tryShow: function () {
            var needShow;
            var trigger;
            if (!this._curTarget) {
                this._findPolarTrigger() || this._findAxisTrigger();
            } else {
                if (this._curTarget._type === 'island' && this.option.tooltip.show) {
                    this._showItemTrigger();
                    return;
                }
                var serie = ecData.get(this._curTarget, 'series');
                var data = ecData.get(this._curTarget, 'data');
                needShow = this.deepQuery([
                    data,
                    serie,
                    this.option
                ], 'tooltip.show');
                if (serie == null || data == null || !needShow) {
                    clearTimeout(this._hidingTicket);
                    clearTimeout(this._showingTicket);
                    this._hidingTicket = setTimeout(this._hide, this._hideDelay);
                } else {
                    trigger = this.deepQuery([
                        data,
                        serie,
                        this.option
                    ], 'tooltip.trigger');
                    trigger === 'axis' ? this._showAxisTrigger(serie.xAxisIndex, serie.yAxisIndex, ecData.get(this._curTarget, 'dataIndex')) : this._showItemTrigger();
                }
            }
        },
        _findAxisTrigger: function () {
            if (!this.component.xAxis || !this.component.yAxis) {
                this._hidingTicket = setTimeout(this._hide, this._hideDelay);
                return;
            }
            var series = this.option.series;
            var xAxisIndex;
            var yAxisIndex;
            for (var i = 0, l = series.length; i < l; i++) {
                if (this.deepQuery([
                        series[i],
                        this.option
                    ], 'tooltip.trigger') === 'axis') {
                    xAxisIndex = series[i].xAxisIndex || 0;
                    yAxisIndex = series[i].yAxisIndex || 0;
                    if (this.component.xAxis.getAxis(xAxisIndex) && this.component.xAxis.getAxis(xAxisIndex).type === ecConfig.COMPONENT_TYPE_AXIS_CATEGORY) {
                        this._showAxisTrigger(xAxisIndex, yAxisIndex, this._getNearestDataIndex('x', this.component.xAxis.getAxis(xAxisIndex)));
                        return;
                    } else if (this.component.yAxis.getAxis(yAxisIndex) && this.component.yAxis.getAxis(yAxisIndex).type === ecConfig.COMPONENT_TYPE_AXIS_CATEGORY) {
                        this._showAxisTrigger(xAxisIndex, yAxisIndex, this._getNearestDataIndex('y', this.component.yAxis.getAxis(yAxisIndex)));
                        return;
                    } else {
                        this._showAxisTrigger(xAxisIndex, yAxisIndex, -1);
                        return;
                    }
                }
            }
            if (this.option.tooltip.axisPointer.type === 'cross') {
                this._showAxisTrigger(-1, -1, -1);
            }
        },
        _findPolarTrigger: function () {
            if (!this.component.polar) {
                return false;
            }
            var x = zrEvent.getX(this._event);
            var y = zrEvent.getY(this._event);
            var polarIndex = this.component.polar.getNearestIndex([
                x,
                y
            ]);
            var valueIndex;
            if (polarIndex) {
                valueIndex = polarIndex.valueIndex;
                polarIndex = polarIndex.polarIndex;
            } else {
                polarIndex = -1;
            }
            if (polarIndex != -1) {
                return this._showPolarTrigger(polarIndex, valueIndex);
            }
            return false;
        },
        _getNearestDataIndex: function (direction, categoryAxis) {
            var dataIndex = -1;
            var x = zrEvent.getX(this._event);
            var y = zrEvent.getY(this._event);
            if (direction === 'x') {
                var left;
                var right;
                var xEnd = this.component.grid.getXend();
                var curCoord = categoryAxis.getCoordByIndex(dataIndex);
                while (curCoord < xEnd) {
                    right = curCoord;
                    if (curCoord <= x) {
                        left = curCoord;
                    } else {
                        break;
                    }
                    curCoord = categoryAxis.getCoordByIndex(++dataIndex);
                }
                if (dataIndex <= 0) {
                    dataIndex = 0;
                } else if (x - left <= right - x) {
                    dataIndex -= 1;
                } else {
                    if (categoryAxis.getNameByIndex(dataIndex) == null) {
                        dataIndex -= 1;
                    }
                }
                return dataIndex;
            } else {
                var top;
                var bottom;
                var yStart = this.component.grid.getY();
                var curCoord = categoryAxis.getCoordByIndex(dataIndex);
                while (curCoord > yStart) {
                    top = curCoord;
                    if (curCoord >= y) {
                        bottom = curCoord;
                    } else {
                        break;
                    }
                    curCoord = categoryAxis.getCoordByIndex(++dataIndex);
                }
                if (dataIndex <= 0) {
                    dataIndex = 0;
                } else if (y - top >= bottom - y) {
                    dataIndex -= 1;
                } else {
                    if (categoryAxis.getNameByIndex(dataIndex) == null) {
                        dataIndex -= 1;
                    }
                }
                return dataIndex;
            }
            return -1;
        },
        _showAxisTrigger: function (xAxisIndex, yAxisIndex, dataIndex) {
            !this._event.connectTrigger && this.messageCenter.dispatch(ecConfig.EVENT.TOOLTIP_IN_GRID, this._event, null, this.myChart);
            if (this.component.xAxis == null || this.component.yAxis == null || xAxisIndex == null || yAxisIndex == null) {
                clearTimeout(this._hidingTicket);
                clearTimeout(this._showingTicket);
                this._hidingTicket = setTimeout(this._hide, this._hideDelay);
                return;
            }
            var series = this.option.series;
            var seriesArray = [];
            var seriesIndex = [];
            var categoryAxis;
            var formatter;
            var position;
            var showContent;
            var specialCssText = '';
            if (this.option.tooltip.trigger === 'axis') {
                if (!this.option.tooltip.show) {
                    return;
                }
                formatter = this.option.tooltip.formatter;
                position = this.option.tooltip.position;
            }
            var axisLayout = xAxisIndex != -1 && this.component.xAxis.getAxis(xAxisIndex).type === ecConfig.COMPONENT_TYPE_AXIS_CATEGORY ? 'xAxis' : yAxisIndex != -1 && this.component.yAxis.getAxis(yAxisIndex).type === ecConfig.COMPONENT_TYPE_AXIS_CATEGORY ? 'yAxis' : false;
            var x;
            var y;
            if (axisLayout) {
                var axisIndex = axisLayout == 'xAxis' ? xAxisIndex : yAxisIndex;
                categoryAxis = this.component[axisLayout].getAxis(axisIndex);
                for (var i = 0, l = series.length; i < l; i++) {
                    if (!this._isSelected(series[i].name)) {
                        continue;
                    }
                    if (series[i][axisLayout + 'Index'] === axisIndex && this.deepQuery([
                            series[i],
                            this.option
                        ], 'tooltip.trigger') === 'axis') {
                        showContent = this.query(series[i], 'tooltip.showContent') || showContent;
                        formatter = this.query(series[i], 'tooltip.formatter') || formatter;
                        position = this.query(series[i], 'tooltip.position') || position;
                        specialCssText += this._style(this.query(series[i], 'tooltip'));
                        if (series[i].stack != null && axisLayout == 'xAxis') {
                            seriesArray.unshift(series[i]);
                            seriesIndex.unshift(i);
                        } else {
                            seriesArray.push(series[i]);
                            seriesIndex.push(i);
                        }
                    }
                }
                this.messageCenter.dispatch(ecConfig.EVENT.TOOLTIP_HOVER, this._event, {
                    seriesIndex: seriesIndex,
                    dataIndex: dataIndex
                }, this.myChart);
                var rect;
                if (axisLayout == 'xAxis') {
                    x = this.subPixelOptimize(categoryAxis.getCoordByIndex(dataIndex), this._axisLineWidth);
                    y = zrEvent.getY(this._event);
                    rect = [
                        x,
                        this.component.grid.getY(),
                        x,
                        this.component.grid.getYend()
                    ];
                } else {
                    x = zrEvent.getX(this._event);
                    y = this.subPixelOptimize(categoryAxis.getCoordByIndex(dataIndex), this._axisLineWidth);
                    rect = [
                        this.component.grid.getX(),
                        y,
                        this.component.grid.getXend(),
                        y
                    ];
                }
                this._styleAxisPointer(seriesArray, rect[0], rect[1], rect[2], rect[3], categoryAxis.getGap(), x, y);
            } else {
                x = zrEvent.getX(this._event);
                y = zrEvent.getY(this._event);
                this._styleAxisPointer(series, this.component.grid.getX(), y, this.component.grid.getXend(), y, 0, x, y);
                if (dataIndex >= 0) {
                    this._showItemTrigger(true);
                } else {
                    clearTimeout(this._hidingTicket);
                    clearTimeout(this._showingTicket);
                    this._tDom.style.display = 'none';
                }
            }
            if (seriesArray.length > 0) {
                this._lastItemTriggerId = -1;
                if (this._lastDataIndex != dataIndex || this._lastSeriesIndex != seriesIndex[0]) {
                    this._lastDataIndex = dataIndex;
                    this._lastSeriesIndex = seriesIndex[0];
                    var data;
                    var value;
                    if (typeof formatter === 'function') {
                        var params = [];
                        for (var i = 0, l = seriesArray.length; i < l; i++) {
                            data = seriesArray[i].data[dataIndex];
                            value = this.getDataFromOption(data, '-');
                            params.push({
                                seriesIndex: seriesIndex[i],
                                seriesName: seriesArray[i].name || '',
                                series: seriesArray[i],
                                dataIndex: dataIndex,
                                data: data,
                                name: categoryAxis.getNameByIndex(dataIndex),
                                value: value,
                                0: seriesArray[i].name || '',
                                1: categoryAxis.getNameByIndex(dataIndex),
                                2: value,
                                3: data
                            });
                        }
                        this._curTicket = 'axis:' + dataIndex;
                        this._tDom.innerHTML = formatter.call(this.myChart, params, this._curTicket, this._setContent);
                    } else if (typeof formatter === 'string') {
                        this._curTicket = NaN;
                        formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}').replace('{c}', '{c0}');
                        for (var i = 0, l = seriesArray.length; i < l; i++) {
                            formatter = formatter.replace('{a' + i + '}', this._encodeHTML(seriesArray[i].name || ''));
                            formatter = formatter.replace('{b' + i + '}', this._encodeHTML(categoryAxis.getNameByIndex(dataIndex)));
                            data = seriesArray[i].data[dataIndex];
                            data = this.getDataFromOption(data, '-');
                            formatter = formatter.replace('{c' + i + '}', data instanceof Array ? data : this.numAddCommas(data));
                        }
                        this._tDom.innerHTML = formatter;
                    } else {
                        this._curTicket = NaN;
                        formatter = this._encodeHTML(categoryAxis.getNameByIndex(dataIndex));
                        for (var i = 0, l = seriesArray.length; i < l; i++) {
                            formatter += '<br/>' + this._encodeHTML(seriesArray[i].name || '') + ' : ';
                            data = seriesArray[i].data[dataIndex];
                            data = this.getDataFromOption(data, '-');
                            formatter += data instanceof Array ? data : this.numAddCommas(data);
                        }
                        this._tDom.innerHTML = formatter;
                    }
                }
                if (showContent === false || !this.option.tooltip.showContent) {
                    return;
                }
                if (!this.hasAppend) {
                    this._tDom.style.left = this._zrWidth / 2 + 'px';
                    this._tDom.style.top = this._zrHeight / 2 + 'px';
                    this.dom.firstChild.appendChild(this._tDom);
                    this.hasAppend = true;
                }
                this._show(position, x + 10, y + 10, specialCssText);
            }
        },
        _showPolarTrigger: function (polarIndex, dataIndex) {
            if (this.component.polar == null || polarIndex == null || dataIndex == null || dataIndex < 0) {
                return false;
            }
            var series = this.option.series;
            var seriesArray = [];
            var seriesIndex = [];
            var formatter;
            var position;
            var showContent;
            var specialCssText = '';
            if (this.option.tooltip.trigger === 'axis') {
                if (!this.option.tooltip.show) {
                    return false;
                }
                formatter = this.option.tooltip.formatter;
                position = this.option.tooltip.position;
            }
            var indicatorName = this.option.polar[polarIndex].indicator[dataIndex].text;
            for (var i = 0, l = series.length; i < l; i++) {
                if (!this._isSelected(series[i].name)) {
                    continue;
                }
                if (series[i].polarIndex === polarIndex && this.deepQuery([
                        series[i],
                        this.option
                    ], 'tooltip.trigger') === 'axis') {
                    showContent = this.query(series[i], 'tooltip.showContent') || showContent;
                    formatter = this.query(series[i], 'tooltip.formatter') || formatter;
                    position = this.query(series[i], 'tooltip.position') || position;
                    specialCssText += this._style(this.query(series[i], 'tooltip'));
                    seriesArray.push(series[i]);
                    seriesIndex.push(i);
                }
            }
            if (seriesArray.length > 0) {
                var polarData;
                var data;
                var value;
                var params = [];
                for (var i = 0, l = seriesArray.length; i < l; i++) {
                    polarData = seriesArray[i].data;
                    for (var j = 0, k = polarData.length; j < k; j++) {
                        data = polarData[j];
                        if (!this._isSelected(data.name)) {
                            continue;
                        }
                        data = data != null ? data : {
                            name: '',
                            value: { dataIndex: '-' }
                        };
                        value = this.getDataFromOption(data.value[dataIndex]);
                        params.push({
                            seriesIndex: seriesIndex[i],
                            seriesName: seriesArray[i].name || '',
                            series: seriesArray[i],
                            dataIndex: dataIndex,
                            data: data,
                            name: data.name,
                            indicator: indicatorName,
                            value: value,
                            0: seriesArray[i].name || '',
                            1: data.name,
                            2: value,
                            3: indicatorName
                        });
                    }
                }
                if (params.length <= 0) {
                    return;
                }
                this._lastItemTriggerId = -1;
                if (this._lastDataIndex != dataIndex || this._lastSeriesIndex != seriesIndex[0]) {
                    this._lastDataIndex = dataIndex;
                    this._lastSeriesIndex = seriesIndex[0];
                    if (typeof formatter === 'function') {
                        this._curTicket = 'axis:' + dataIndex;
                        this._tDom.innerHTML = formatter.call(this.myChart, params, this._curTicket, this._setContent);
                    } else if (typeof formatter === 'string') {
                        formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}').replace('{c}', '{c0}').replace('{d}', '{d0}');
                        for (var i = 0, l = params.length; i < l; i++) {
                            formatter = formatter.replace('{a' + i + '}', this._encodeHTML(params[i].seriesName));
                            formatter = formatter.replace('{b' + i + '}', this._encodeHTML(params[i].name));
                            formatter = formatter.replace('{c' + i + '}', this.numAddCommas(params[i].value));
                            formatter = formatter.replace('{d' + i + '}', this._encodeHTML(params[i].indicator));
                        }
                        this._tDom.innerHTML = formatter;
                    } else {
                        formatter = this._encodeHTML(params[0].name) + '<br/>' + this._encodeHTML(params[0].indicator) + ' : ' + this.numAddCommas(params[0].value);
                        for (var i = 1, l = params.length; i < l; i++) {
                            formatter += '<br/>' + this._encodeHTML(params[i].name) + '<br/>';
                            formatter += this._encodeHTML(params[i].indicator) + ' : ' + this.numAddCommas(params[i].value);
                        }
                        this._tDom.innerHTML = formatter;
                    }
                }
                if (showContent === false || !this.option.tooltip.showContent) {
                    return;
                }
                if (!this.hasAppend) {
                    this._tDom.style.left = this._zrWidth / 2 + 'px';
                    this._tDom.style.top = this._zrHeight / 2 + 'px';
                    this.dom.firstChild.appendChild(this._tDom);
                    this.hasAppend = true;
                }
                this._show(position, zrEvent.getX(this._event), zrEvent.getY(this._event), specialCssText);
                return true;
            }
        },
        _showItemTrigger: function (axisTrigger) {
            if (!this._curTarget) {
                return;
            }
            var serie = ecData.get(this._curTarget, 'series');
            var seriesIndex = ecData.get(this._curTarget, 'seriesIndex');
            var data = ecData.get(this._curTarget, 'data');
            var dataIndex = ecData.get(this._curTarget, 'dataIndex');
            var name = ecData.get(this._curTarget, 'name');
            var value = ecData.get(this._curTarget, 'value');
            var special = ecData.get(this._curTarget, 'special');
            var special2 = ecData.get(this._curTarget, 'special2');
            var queryTarget = [
                data,
                serie,
                this.option
            ];
            var formatter;
            var position;
            var showContent;
            var specialCssText = '';
            if (this._curTarget._type != 'island') {
                var trigger = axisTrigger ? 'axis' : 'item';
                if (this.option.tooltip.trigger === trigger) {
                    formatter = this.option.tooltip.formatter;
                    position = this.option.tooltip.position;
                }
                if (this.query(serie, 'tooltip.trigger') === trigger) {
                    showContent = this.query(serie, 'tooltip.showContent') || showContent;
                    formatter = this.query(serie, 'tooltip.formatter') || formatter;
                    position = this.query(serie, 'tooltip.position') || position;
                    specialCssText += this._style(this.query(serie, 'tooltip'));
                }
                showContent = this.query(data, 'tooltip.showContent') || showContent;
                formatter = this.query(data, 'tooltip.formatter') || formatter;
                position = this.query(data, 'tooltip.position') || position;
                specialCssText += this._style(this.query(data, 'tooltip'));
            } else {
                this._lastItemTriggerId = NaN;
                showContent = this.deepQuery(queryTarget, 'tooltip.showContent');
                formatter = this.deepQuery(queryTarget, 'tooltip.islandFormatter');
                position = this.deepQuery(queryTarget, 'tooltip.islandPosition');
            }
            this._lastDataIndex = -1;
            this._lastSeriesIndex = -1;
            if (this._lastItemTriggerId !== this._curTarget.id) {
                this._lastItemTriggerId = this._curTarget.id;
                if (typeof formatter === 'function') {
                    this._curTicket = (serie.name || '') + ':' + dataIndex;
                    this._tDom.innerHTML = formatter.call(this.myChart, {
                        seriesIndex: seriesIndex,
                        seriesName: serie.name || '',
                        series: serie,
                        dataIndex: dataIndex,
                        data: data,
                        name: name,
                        value: value,
                        percent: special,
                        indicator: special,
                        value2: special2,
                        indicator2: special2,
                        0: serie.name || '',
                        1: name,
                        2: value,
                        3: special,
                        4: special2,
                        5: data,
                        6: seriesIndex,
                        7: dataIndex
                    }, this._curTicket, this._setContent);
                } else if (typeof formatter === 'string') {
                    this._curTicket = NaN;
                    formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}').replace('{c}', '{c0}');
                    formatter = formatter.replace('{a0}', this._encodeHTML(serie.name || '')).replace('{b0}', this._encodeHTML(name)).replace('{c0}', value instanceof Array ? value : this.numAddCommas(value));
                    formatter = formatter.replace('{d}', '{d0}').replace('{d0}', special || '');
                    formatter = formatter.replace('{e}', '{e0}').replace('{e0}', ecData.get(this._curTarget, 'special2') || '');
                    this._tDom.innerHTML = formatter;
                } else {
                    this._curTicket = NaN;
                    if (serie.type === ecConfig.CHART_TYPE_RADAR && special) {
                        this._tDom.innerHTML = this._itemFormatter.radar.call(this, serie, name, value, special);
                    } else if (serie.type === ecConfig.CHART_TYPE_EVENTRIVER) {
                        this._tDom.innerHTML = this._itemFormatter.eventRiver.call(this, serie, name, value, data);
                    } else {
                        this._tDom.innerHTML = '' + (serie.name != null ? this._encodeHTML(serie.name) + '<br/>' : '') + (name === '' ? '' : this._encodeHTML(name) + ' : ') + (value instanceof Array ? value : this.numAddCommas(value));
                    }
                }
            }
            var x = zrEvent.getX(this._event);
            var y = zrEvent.getY(this._event);
            if (this.deepQuery(queryTarget, 'tooltip.axisPointer.show') && this.component.grid) {
                this._styleAxisPointer([serie], this.component.grid.getX(), y, this.component.grid.getXend(), y, 0, x, y);
            } else {
                this._hide();
            }
            if (showContent === false || !this.option.tooltip.showContent) {
                return;
            }
            if (!this.hasAppend) {
                this._tDom.style.left = this._zrWidth / 2 + 'px';
                this._tDom.style.top = this._zrHeight / 2 + 'px';
                this.dom.firstChild.appendChild(this._tDom);
                this.hasAppend = true;
            }
            this._show(position, x + 20, y - 20, specialCssText);
        },
        _itemFormatter: {
            radar: function (serie, name, value, indicator) {
                var html = '';
                html += this._encodeHTML(name === '' ? serie.name || '' : name);
                html += html === '' ? '' : '<br />';
                for (var i = 0; i < indicator.length; i++) {
                    html += this._encodeHTML(indicator[i].text) + ' : ' + this.numAddCommas(value[i]) + '<br />';
                }
                return html;
            },
            chord: function (serie, name, value, special, special2) {
                if (special2 == null) {
                    return this._encodeHTML(name) + ' (' + this.numAddCommas(value) + ')';
                } else {
                    var name1 = this._encodeHTML(name);
                    var name2 = this._encodeHTML(special);
                    return '' + (serie.name != null ? this._encodeHTML(serie.name) + '<br/>' : '') + name1 + ' -> ' + name2 + ' (' + this.numAddCommas(value) + ')' + '<br />' + name2 + ' -> ' + name1 + ' (' + this.numAddCommas(special2) + ')';
                }
            },
            eventRiver: function (serie, name, value, data) {
                var html = '';
                html += this._encodeHTML(serie.name === '' ? '' : serie.name + ' : ');
                html += this._encodeHTML(name);
                html += html === '' ? '' : '<br />';
                data = data.evolution;
                for (var i = 0, l = data.length; i < l; i++) {
                    html += '<div style="padding-top:5px;">';
                    if (!data[i].detail) {
                        continue;
                    }
                    if (data[i].detail.img) {
                        html += '<img src="' + data[i].detail.img + '" style="float:left;width:40px;height:40px;">';
                    }
                    html += '<div style="margin-left:45px;">' + data[i].time + '<br/>';
                    html += '<a href="' + data[i].detail.link + '" target="_blank">';
                    html += data[i].detail.text + '</a></div>';
                    html += '</div>';
                }
                return html;
            }
        },
        _styleAxisPointer: function (seriesArray, xStart, yStart, xEnd, yEnd, gap, x, y) {
            if (seriesArray.length > 0) {
                var queryTarget;
                var curType;
                var axisPointer = this.option.tooltip.axisPointer;
                var pointType = axisPointer.type;
                var style = {
                    line: {},
                    cross: {},
                    shadow: {}
                };
                for (var pType in style) {
                    style[pType].color = axisPointer[pType + 'Style'].color;
                    style[pType].width = axisPointer[pType + 'Style'].width;
                    style[pType].type = axisPointer[pType + 'Style'].type;
                }
                for (var i = 0, l = seriesArray.length; i < l; i++) {
                    queryTarget = seriesArray[i];
                    curType = this.query(queryTarget, 'tooltip.axisPointer.type');
                    pointType = curType || pointType;
                    if (curType) {
                        style[curType].color = this.query(queryTarget, 'tooltip.axisPointer.' + curType + 'Style.color') || style[curType].color;
                        style[curType].width = this.query(queryTarget, 'tooltip.axisPointer.' + curType + 'Style.width') || style[curType].width;
                        style[curType].type = this.query(queryTarget, 'tooltip.axisPointer.' + curType + 'Style.type') || style[curType].type;
                    }
                }
                if (pointType === 'line') {
                    var lineWidth = style.line.width;
                    var isVertical = xStart == xEnd;
                    this._axisLineShape.style = {
                        xStart: isVertical ? this.subPixelOptimize(xStart, lineWidth) : xStart,
                        yStart: isVertical ? yStart : this.subPixelOptimize(yStart, lineWidth),
                        xEnd: isVertical ? this.subPixelOptimize(xEnd, lineWidth) : xEnd,
                        yEnd: isVertical ? yEnd : this.subPixelOptimize(yEnd, lineWidth),
                        strokeColor: style.line.color,
                        lineWidth: lineWidth,
                        lineType: style.line.type
                    };
                    this._axisLineShape.invisible = false;
                    this.zr.modShape(this._axisLineShape.id);
                } else if (pointType === 'cross') {
                    var crossWidth = style.cross.width;
                    this._axisCrossShape.style = {
                        brushType: 'stroke',
                        rect: this.component.grid.getArea(),
                        x: this.subPixelOptimize(x, crossWidth),
                        y: this.subPixelOptimize(y, crossWidth),
                        text: ('( ' + this.component.xAxis.getAxis(0).getValueFromCoord(x) + ' , ' + this.component.yAxis.getAxis(0).getValueFromCoord(y) + ' )').replace('  , ', ' ').replace(' ,  ', ' '),
                        textPosition: 'specific',
                        strokeColor: style.cross.color,
                        lineWidth: crossWidth,
                        lineType: style.cross.type
                    };
                    if (this.component.grid.getXend() - x > 100) {
                        this._axisCrossShape.style.textAlign = 'left';
                        this._axisCrossShape.style.textX = x + 10;
                    } else {
                        this._axisCrossShape.style.textAlign = 'right';
                        this._axisCrossShape.style.textX = x - 10;
                    }
                    if (y - this.component.grid.getY() > 50) {
                        this._axisCrossShape.style.textBaseline = 'bottom';
                        this._axisCrossShape.style.textY = y - 10;
                    } else {
                        this._axisCrossShape.style.textBaseline = 'top';
                        this._axisCrossShape.style.textY = y + 10;
                    }
                    this._axisCrossShape.invisible = false;
                    this.zr.modShape(this._axisCrossShape.id);
                } else if (pointType === 'shadow') {
                    if (style.shadow.width == null || style.shadow.width === 'auto' || isNaN(style.shadow.width)) {
                        style.shadow.width = gap;
                    }
                    if (xStart === xEnd) {
                        if (Math.abs(this.component.grid.getX() - xStart) < 2) {
                            style.shadow.width /= 2;
                            xStart = xEnd = xEnd + style.shadow.width / 2;
                        } else if (Math.abs(this.component.grid.getXend() - xStart) < 2) {
                            style.shadow.width /= 2;
                            xStart = xEnd = xEnd - style.shadow.width / 2;
                        }
                    } else if (yStart === yEnd) {
                        if (Math.abs(this.component.grid.getY() - yStart) < 2) {
                            style.shadow.width /= 2;
                            yStart = yEnd = yEnd + style.shadow.width / 2;
                        } else if (Math.abs(this.component.grid.getYend() - yStart) < 2) {
                            style.shadow.width /= 2;
                            yStart = yEnd = yEnd - style.shadow.width / 2;
                        }
                    }
                    this._axisShadowShape.style = {
                        xStart: xStart,
                        yStart: yStart,
                        xEnd: xEnd,
                        yEnd: yEnd,
                        strokeColor: style.shadow.color,
                        lineWidth: style.shadow.width
                    };
                    this._axisShadowShape.invisible = false;
                    this.zr.modShape(this._axisShadowShape.id);
                }
                this.zr.refreshNextFrame();
            }
        },
        __onmousemove: function (param) {
            clearTimeout(this._hidingTicket);
            clearTimeout(this._showingTicket);
            if (this._mousein && this._enterable) {
                return;
            }
            var target = param.target;
            var mx = zrEvent.getX(param.event);
            var my = zrEvent.getY(param.event);
            if (!target) {
                this._curTarget = false;
                this._event = param.event;
                this._event.zrenderX = mx;
                this._event.zrenderY = my;
                if (this._needAxisTrigger && this.component.grid && zrArea.isInside(rectangleInstance, this.component.grid.getArea(), mx, my)) {
                    this._showingTicket = setTimeout(this._tryShow, this._showDelay);
                } else if (this._needAxisTrigger && this.component.polar && this.component.polar.isInside([
                        mx,
                        my
                    ]) != -1) {
                    this._showingTicket = setTimeout(this._tryShow, this._showDelay);
                } else {
                    !this._event.connectTrigger && this.messageCenter.dispatch(ecConfig.EVENT.TOOLTIP_OUT_GRID, this._event, null, this.myChart);
                    this._hidingTicket = setTimeout(this._hide, this._hideDelay);
                }
            } else {
                this._curTarget = target;
                this._event = param.event;
                this._event.zrenderX = mx;
                this._event.zrenderY = my;
                var polarIndex;
                if (this._needAxisTrigger && this.component.polar && (polarIndex = this.component.polar.isInside([
                        mx,
                        my
                    ])) != -1) {
                    var series = this.option.series;
                    for (var i = 0, l = series.length; i < l; i++) {
                        if (series[i].polarIndex === polarIndex && this.deepQuery([
                                series[i],
                                this.option
                            ], 'tooltip.trigger') === 'axis') {
                            this._curTarget = null;
                            break;
                        }
                    }
                }
                this._showingTicket = setTimeout(this._tryShow, this._showDelay);
            }
        },
        __onglobalout: function () {
            clearTimeout(this._hidingTicket);
            clearTimeout(this._showingTicket);
            this._hidingTicket = setTimeout(this._hide, this._hideDelay);
        },
        __setContent: function (ticket, content) {
            if (!this._tDom) {
                return;
            }
            if (ticket === this._curTicket) {
                this._tDom.innerHTML = content;
            }
            setTimeout(this._refixed, 20);
        },
        ontooltipHover: function (param, tipShape) {
            if (!this._lastTipShape || this._lastTipShape && this._lastTipShape.dataIndex != param.dataIndex) {
                if (this._lastTipShape && this._lastTipShape.tipShape.length > 0) {
                    this.zr.delShape(this._lastTipShape.tipShape);
                    this.shapeList.length = 2;
                }
                for (var i = 0, l = tipShape.length; i < l; i++) {
                    tipShape[i].zlevel = this.getZlevelBase();
                    tipShape[i].z = this.getZBase();
                    tipShape[i].style = zrShapeBase.prototype.getHighlightStyle(tipShape[i].style, tipShape[i].highlightStyle);
                    tipShape[i].draggable = false;
                    tipShape[i].hoverable = false;
                    tipShape[i].clickable = false;
                    tipShape[i].ondragend = null;
                    tipShape[i].ondragover = null;
                    tipShape[i].ondrop = null;
                    this.shapeList.push(tipShape[i]);
                    this.zr.addShape(tipShape[i]);
                }
                this._lastTipShape = {
                    dataIndex: param.dataIndex,
                    tipShape: tipShape
                };
            }
        },
        ondragend: function () {
            this._hide();
        },
        onlegendSelected: function (param) {
            this._selectedMap = param.selected;
        },
        _setSelectedMap: function () {
            if (this.component.legend) {
                this._selectedMap = zrUtil.clone(this.component.legend.getSelectedMap());
            } else {
                this._selectedMap = {};
            }
        },
        _isSelected: function (itemName) {
            if (this._selectedMap[itemName] != null) {
                return this._selectedMap[itemName];
            } else {
                return true;
            }
        },
        showTip: function (params) {
            if (!params) {
                return;
            }
            var seriesIndex;
            var series = this.option.series;
            if (params.seriesIndex != null) {
                seriesIndex = params.seriesIndex;
            } else {
                var seriesName = params.seriesName;
                for (var i = 0, l = series.length; i < l; i++) {
                    if (series[i].name === seriesName) {
                        seriesIndex = i;
                        break;
                    }
                }
            }
            var serie = series[seriesIndex];
            if (serie == null) {
                return;
            }
            var chart = this.myChart.chart[serie.type];
            var isAxisTrigger = this.deepQuery([
                serie,
                this.option
            ], 'tooltip.trigger') === 'axis';
            if (!chart) {
                return;
            }
            if (isAxisTrigger) {
                var dataIndex = params.dataIndex;
                switch (chart.type) {
                case ecConfig.CHART_TYPE_LINE:
                case ecConfig.CHART_TYPE_BAR:
                case ecConfig.CHART_TYPE_K:
                    if (this.component.xAxis == null || this.component.yAxis == null || serie.data.length <= dataIndex) {
                        return;
                    }
                    var xAxisIndex = serie.xAxisIndex || 0;
                    var yAxisIndex = serie.yAxisIndex || 0;
                    if (this.component.xAxis.getAxis(xAxisIndex).type === ecConfig.COMPONENT_TYPE_AXIS_CATEGORY) {
                        this._event = {
                            zrenderX: this.component.xAxis.getAxis(xAxisIndex).getCoordByIndex(dataIndex),
                            zrenderY: this.component.grid.getY() + (this.component.grid.getYend() - this.component.grid.getY()) / 4
                        };
                    } else {
                        this._event = {
                            zrenderX: this.component.grid.getX() + (this.component.grid.getXend() - this.component.grid.getX()) / 4,
                            zrenderY: this.component.yAxis.getAxis(yAxisIndex).getCoordByIndex(dataIndex)
                        };
                    }
                    this._showAxisTrigger(xAxisIndex, yAxisIndex, dataIndex);
                    break;
                case ecConfig.CHART_TYPE_RADAR:
                    if (this.component.polar == null || serie.data[0].value.length <= dataIndex) {
                        return;
                    }
                    var polarIndex = serie.polarIndex || 0;
                    var vector = this.component.polar.getVector(polarIndex, dataIndex, 'max');
                    this._event = {
                        zrenderX: vector[0],
                        zrenderY: vector[1]
                    };
                    this._showPolarTrigger(polarIndex, dataIndex);
                    break;
                }
            } else {
                var shapeList = chart.shapeList;
                var x;
                var y;
                switch (chart.type) {
                case ecConfig.CHART_TYPE_LINE:
                case ecConfig.CHART_TYPE_BAR:
                case ecConfig.CHART_TYPE_K:
                case ecConfig.CHART_TYPE_SCATTER:
                    var dataIndex = params.dataIndex;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i]._mark == null && ecData.get(shapeList[i], 'seriesIndex') == seriesIndex && ecData.get(shapeList[i], 'dataIndex') == dataIndex) {
                            this._curTarget = shapeList[i];
                            x = shapeList[i].style.x;
                            y = chart.type != ecConfig.CHART_TYPE_K ? shapeList[i].style.y : shapeList[i].style.y[0];
                            break;
                        }
                    }
                    break;
                case ecConfig.CHART_TYPE_RADAR:
                    var dataIndex = params.dataIndex;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i].type === 'polygon' && ecData.get(shapeList[i], 'seriesIndex') == seriesIndex && ecData.get(shapeList[i], 'dataIndex') == dataIndex) {
                            this._curTarget = shapeList[i];
                            var vector = this.component.polar.getCenter(serie.polarIndex || 0);
                            x = vector[0];
                            y = vector[1];
                            break;
                        }
                    }
                    break;
                case ecConfig.CHART_TYPE_PIE:
                    var name = params.name;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i].type === 'sector' && ecData.get(shapeList[i], 'seriesIndex') == seriesIndex && ecData.get(shapeList[i], 'name') == name) {
                            this._curTarget = shapeList[i];
                            var style = this._curTarget.style;
                            var midAngle = (style.startAngle + style.endAngle) / 2 * Math.PI / 180;
                            x = this._curTarget.style.x + Math.cos(midAngle) * style.r / 1.5;
                            y = this._curTarget.style.y - Math.sin(midAngle) * style.r / 1.5;
                            break;
                        }
                    }
                    break;
                case ecConfig.CHART_TYPE_MAP:
                    var name = params.name;
                    var mapType = serie.mapType;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i].type === 'text' && shapeList[i]._mapType === mapType && shapeList[i].style._name === name) {
                            this._curTarget = shapeList[i];
                            x = this._curTarget.style.x + this._curTarget.position[0];
                            y = this._curTarget.style.y + this._curTarget.position[1];
                            break;
                        }
                    }
                    break;
                case ecConfig.CHART_TYPE_CHORD:
                    var name = params.name;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i].type === 'sector' && ecData.get(shapeList[i], 'name') == name) {
                            this._curTarget = shapeList[i];
                            var style = this._curTarget.style;
                            var midAngle = (style.startAngle + style.endAngle) / 2 * Math.PI / 180;
                            x = this._curTarget.style.x + Math.cos(midAngle) * (style.r - 2);
                            y = this._curTarget.style.y - Math.sin(midAngle) * (style.r - 2);
                            this.zr.trigger(zrConfig.EVENT.MOUSEMOVE, {
                                zrenderX: x,
                                zrenderY: y
                            });
                            return;
                        }
                    }
                    break;
                case ecConfig.CHART_TYPE_FORCE:
                    var name = params.name;
                    for (var i = 0, l = shapeList.length; i < l; i++) {
                        if (shapeList[i].type === 'circle' && ecData.get(shapeList[i], 'name') == name) {
                            this._curTarget = shapeList[i];
                            x = this._curTarget.position[0];
                            y = this._curTarget.position[1];
                            break;
                        }
                    }
                    break;
                }
                if (x != null && y != null) {
                    this._event = {
                        zrenderX: x,
                        zrenderY: y
                    };
                    this.zr.addHoverShape(this._curTarget);
                    this.zr.refreshHover();
                    this._showItemTrigger();
                }
            }
        },
        hideTip: function () {
            this._hide();
        },
        refresh: function (newOption) {
            this._zrHeight = this.zr.getHeight();
            this._zrWidth = this.zr.getWidth();
            if (this._lastTipShape && this._lastTipShape.tipShape.length > 0) {
                this.zr.delShape(this._lastTipShape.tipShape);
            }
            this._lastTipShape = false;
            this.shapeList.length = 2;
            this._lastDataIndex = -1;
            this._lastSeriesIndex = -1;
            this._lastItemTriggerId = -1;
            if (newOption) {
                this.option = newOption;
                this.option.tooltip = this.reformOption(this.option.tooltip);
                this.option.tooltip.textStyle = zrUtil.merge(this.option.tooltip.textStyle, this.ecTheme.textStyle);
                this._needAxisTrigger = false;
                if (this.option.tooltip.trigger === 'axis') {
                    this._needAxisTrigger = true;
                }
                var series = this.option.series;
                for (var i = 0, l = series.length; i < l; i++) {
                    if (this.query(series[i], 'tooltip.trigger') === 'axis') {
                        this._needAxisTrigger = true;
                        break;
                    }
                }
                this._showDelay = this.option.tooltip.showDelay;
                this._hideDelay = this.option.tooltip.hideDelay;
                this._defaultCssText = this._style(this.option.tooltip);
                this._setSelectedMap();
                this._axisLineWidth = this.option.tooltip.axisPointer.lineStyle.width;
                this._enterable = this.option.tooltip.enterable;
            }
            if (this.showing) {
                var self = this;
                setTimeout(function () {
                    self.zr.trigger(zrConfig.EVENT.MOUSEMOVE, self.zr.handler._event);
                }, 50);
            }
        },
        onbeforDispose: function () {
            if (this._lastTipShape && this._lastTipShape.tipShape.length > 0) {
                this.zr.delShape(this._lastTipShape.tipShape);
            }
            clearTimeout(this._hidingTicket);
            clearTimeout(this._showingTicket);
            this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            this.zr.un(zrConfig.EVENT.GLOBALOUT, this._onglobalout);
            if (this.hasAppend && !!this.dom.firstChild) {
                this.dom.firstChild.removeChild(this._tDom);
            }
            this._tDom = null;
        },
        _encodeHTML: function (source) {
            return String(source).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };
    zrUtil.inherits(Tooltip, Base);
    require('../component').define('tooltip', Tooltip);
    return Tooltip;
});define('echarts/component/legend', [
    'require',
    './base',
    'zrender/shape/Text',
    'zrender/shape/Rectangle',
    'zrender/shape/Sector',
    '../util/shape/Icon',
    '../util/shape/Candle',
    '../config',
    'zrender/tool/util',
    'zrender/tool/area',
    '../component'
], function (require) {
    var Base = require('./base');
    var TextShape = require('zrender/shape/Text');
    var RectangleShape = require('zrender/shape/Rectangle');
    var SectorShape = require('zrender/shape/Sector');
    var IconShape = require('../util/shape/Icon');
    var CandleShape = require('../util/shape/Candle');
    var ecConfig = require('../config');
    ecConfig.legend = {
        zlevel: 0,
        z: 4,
        show: true,
        orient: 'horizontal',
        x: 'center',
        y: 'top',
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        itemGap: 10,
        itemWidth: 20,
        itemHeight: 14,
        textStyle: { color: '#333' },
        selectedMode: true
    };
    var zrUtil = require('zrender/tool/util');
    var zrArea = require('zrender/tool/area');
    function Legend(ecTheme, messageCenter, zr, option, myChart) {
        if (!this.query(option, 'legend.data')) {
            console.error('option.legend.data has not been defined.');
            return;
        }
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        var self = this;
        self._legendSelected = function (param) {
            self.__legendSelected(param);
        };
        self._dispatchHoverLink = function (param) {
            return self.__dispatchHoverLink(param);
        };
        this._colorIndex = 0;
        this._colorMap = {};
        this._selectedMap = {};
        this._hasDataMap = {};
        this.refresh(option);
    }
    Legend.prototype = {
        type: ecConfig.COMPONENT_TYPE_LEGEND,
        _buildShape: function () {
            if (!this.legendOption.show) {
                return;
            }
            this._itemGroupLocation = this._getItemGroupLocation();
            this._buildBackground();
            this._buildItem();
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },
        _buildItem: function () {
            var data = this.legendOption.data;
            var dataLength = data.length;
            var itemName;
            var itemType;
            var itemShape;
            var textShape;
            var textStyle = this.legendOption.textStyle;
            var dataTextStyle;
            var dataFont;
            var formattedName;
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemWidth = this.legendOption.itemWidth;
            var itemHeight = this.legendOption.itemHeight;
            var itemGap = this.legendOption.itemGap;
            var color;
            if (this.legendOption.orient === 'vertical' && this.legendOption.x === 'right') {
                lastX = this._itemGroupLocation.x + this._itemGroupLocation.width - itemWidth;
            }
            for (var i = 0; i < dataLength; i++) {
                dataTextStyle = zrUtil.merge(data[i].textStyle || {}, textStyle);
                dataFont = this.getFont(dataTextStyle);
                itemName = this._getName(data[i]);
                formattedName = this._getFormatterName(itemName);
                if (itemName === '') {
                    if (this.legendOption.orient === 'horizontal') {
                        lastX = this._itemGroupLocation.x;
                        lastY += itemHeight + itemGap;
                    } else {
                        this.legendOption.x === 'right' ? lastX -= this._itemGroupLocation.maxWidth + itemGap : lastX += this._itemGroupLocation.maxWidth + itemGap;
                        lastY = this._itemGroupLocation.y;
                    }
                    continue;
                }
                itemType = data[i].icon || this._getSomethingByName(itemName).type;
                color = this.getColor(itemName);
                if (this.legendOption.orient === 'horizontal') {
                    if (zrWidth - lastX < 200 && itemWidth + 5 + zrArea.getTextWidth(formattedName, dataFont) + (i === dataLength - 1 || data[i + 1] === '' ? 0 : itemGap) >= zrWidth - lastX) {
                        lastX = this._itemGroupLocation.x;
                        lastY += itemHeight + itemGap;
                    }
                } else {
                    if (zrHeight - lastY < 200 && itemHeight + (i === dataLength - 1 || data[i + 1] === '' ? 0 : itemGap) >= zrHeight - lastY) {
                        this.legendOption.x === 'right' ? lastX -= this._itemGroupLocation.maxWidth + itemGap : lastX += this._itemGroupLocation.maxWidth + itemGap;
                        lastY = this._itemGroupLocation.y;
                    }
                }
                itemShape = this._getItemShapeByType(lastX, lastY, itemWidth, itemHeight, this._selectedMap[itemName] && this._hasDataMap[itemName] ? color : '#ccc', itemType, color);
                itemShape._name = itemName;
                itemShape = new IconShape(itemShape);
                textShape = {
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        x: lastX + itemWidth + 5,
                        y: lastY + itemHeight / 2,
                        color: this._selectedMap[itemName] ? dataTextStyle.color === 'auto' ? color : dataTextStyle.color : '#ccc',
                        text: formattedName,
                        textFont: dataFont,
                        textBaseline: 'middle'
                    },
                    highlightStyle: {
                        color: color,
                        brushType: 'fill'
                    },
                    hoverable: !!this.legendOption.selectedMode,
                    clickable: !!this.legendOption.selectedMode
                };
                if (this.legendOption.orient === 'vertical' && this.legendOption.x === 'right') {
                    textShape.style.x -= itemWidth + 10;
                    textShape.style.textAlign = 'right';
                }
                textShape._name = itemName;
                textShape = new TextShape(textShape);
                if (this.legendOption.selectedMode) {
                    itemShape.onclick = textShape.onclick = this._legendSelected;
                    itemShape.onmouseover = textShape.onmouseover = this._dispatchHoverLink;
                    itemShape.hoverConnect = textShape.id;
                    textShape.hoverConnect = itemShape.id;
                }
                this.shapeList.push(itemShape);
                this.shapeList.push(textShape);
                if (this.legendOption.orient === 'horizontal') {
                    lastX += itemWidth + 5 + zrArea.getTextWidth(formattedName, dataFont) + itemGap;
                } else {
                    lastY += itemHeight + itemGap;
                }
            }
            if (this.legendOption.orient === 'horizontal' && this.legendOption.x === 'center' && lastY != this._itemGroupLocation.y) {
                this._mLineOptimize();
            }
        },
        _getName: function (data) {
            return typeof data.name != 'undefined' ? data.name : data;
        },
        _getFormatterName: function (itemName) {
            var formatter = this.legendOption.formatter;
            var formattedName;
            if (typeof formatter === 'function') {
                formattedName = formatter.call(this.myChart, itemName);
            } else if (typeof formatter === 'string') {
                formattedName = formatter.replace('{name}', itemName);
            } else {
                formattedName = itemName;
            }
            return formattedName;
        },
        _getFormatterNameFromData: function (data) {
            var itemName = this._getName(data);
            return this._getFormatterName(itemName);
        },
        _mLineOptimize: function () {
            var lineOffsetArray = [];
            var lastX = this._itemGroupLocation.x;
            for (var i = 2, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i].style.x === lastX) {
                    lineOffsetArray.push((this._itemGroupLocation.width - (this.shapeList[i - 1].style.x + zrArea.getTextWidth(this.shapeList[i - 1].style.text, this.shapeList[i - 1].style.textFont) - lastX)) / 2);
                } else if (i === l - 1) {
                    lineOffsetArray.push((this._itemGroupLocation.width - (this.shapeList[i].style.x + zrArea.getTextWidth(this.shapeList[i].style.text, this.shapeList[i].style.textFont) - lastX)) / 2);
                }
            }
            var curLineIndex = -1;
            for (var i = 1, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i].style.x === lastX) {
                    curLineIndex++;
                }
                if (lineOffsetArray[curLineIndex] === 0) {
                    continue;
                } else {
                    this.shapeList[i].style.x += lineOffsetArray[curLineIndex];
                }
            }
        },
        _buildBackground: function () {
            var padding = this.reformCssArray(this.legendOption.padding);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.legendOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.legendOption.backgroundColor,
                    strokeColor: this.legendOption.borderColor,
                    lineWidth: this.legendOption.borderWidth
                }
            }));
        },
        _getItemGroupLocation: function () {
            var data = this.legendOption.data;
            var dataLength = data.length;
            var itemGap = this.legendOption.itemGap;
            var itemWidth = this.legendOption.itemWidth + 5;
            var itemHeight = this.legendOption.itemHeight;
            var textStyle = this.legendOption.textStyle;
            var font = this.getFont(textStyle);
            var totalWidth = 0;
            var totalHeight = 0;
            var padding = this.reformCssArray(this.legendOption.padding);
            var zrWidth = this.zr.getWidth() - padding[1] - padding[3];
            var zrHeight = this.zr.getHeight() - padding[0] - padding[2];
            var temp = 0;
            var maxWidth = 0;
            if (this.legendOption.orient === 'horizontal') {
                totalHeight = itemHeight;
                for (var i = 0; i < dataLength; i++) {
                    if (this._getName(data[i]) === '') {
                        temp -= itemGap;
                        totalWidth = Math.max(totalWidth, temp);
                        totalHeight += itemHeight + itemGap;
                        temp = 0;
                        continue;
                    }
                    var tempTextWidth = zrArea.getTextWidth(this._getFormatterNameFromData(data[i]), data[i].textStyle ? this.getFont(zrUtil.merge(data[i].textStyle || {}, textStyle)) : font);
                    if (temp + itemWidth + tempTextWidth + itemGap > zrWidth) {
                        temp -= itemGap;
                        totalWidth = Math.max(totalWidth, temp);
                        totalHeight += itemHeight + itemGap;
                        temp = 0;
                    } else {
                        temp += itemWidth + tempTextWidth + itemGap;
                        totalWidth = Math.max(totalWidth, temp - itemGap);
                    }
                }
            } else {
                for (var i = 0; i < dataLength; i++) {
                    maxWidth = Math.max(maxWidth, zrArea.getTextWidth(this._getFormatterNameFromData(data[i]), data[i].textStyle ? this.getFont(zrUtil.merge(data[i].textStyle || {}, textStyle)) : font));
                }
                maxWidth += itemWidth;
                totalWidth = maxWidth;
                for (var i = 0; i < dataLength; i++) {
                    if (this._getName(data[i]) === '') {
                        totalWidth += maxWidth + itemGap;
                        temp -= itemGap;
                        totalHeight = Math.max(totalHeight, temp);
                        temp = 0;
                        continue;
                    }
                    if (temp + itemHeight + itemGap > zrHeight) {
                        totalWidth += maxWidth + itemGap;
                        temp -= itemGap;
                        totalHeight = Math.max(totalHeight, temp);
                        temp = 0;
                    } else {
                        temp += itemHeight + itemGap;
                        totalHeight = Math.max(totalHeight, temp - itemGap);
                    }
                }
            }
            zrWidth = this.zr.getWidth();
            zrHeight = this.zr.getHeight();
            var x;
            switch (this.legendOption.x) {
            case 'center':
                x = Math.floor((zrWidth - totalWidth) / 2);
                break;
            case 'left':
                x = padding[3] + this.legendOption.borderWidth;
                break;
            case 'right':
                x = zrWidth - totalWidth - padding[1] - padding[3] - this.legendOption.borderWidth * 2;
                break;
            default:
                x = this.parsePercent(this.legendOption.x, zrWidth);
                break;
            }
            var y;
            switch (this.legendOption.y) {
            case 'top':
                y = padding[0] + this.legendOption.borderWidth;
                break;
            case 'bottom':
                y = zrHeight - totalHeight - padding[0] - padding[2] - this.legendOption.borderWidth * 2;
                break;
            case 'center':
                y = Math.floor((zrHeight - totalHeight) / 2);
                break;
            default:
                y = this.parsePercent(this.legendOption.y, zrHeight);
                break;
            }
            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight,
                maxWidth: maxWidth
            };
        },
        _getSomethingByName: function (name) {
            var series = this.option.series;
            var data;
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].name === name) {
                    return {
                        type: series[i].type,
                        series: series[i],
                        seriesIndex: i,
                        data: null,
                        dataIndex: -1
                    };
                }
                if (series[i].type === ecConfig.CHART_TYPE_PIE || series[i].type === ecConfig.CHART_TYPE_RADAR || series[i].type === ecConfig.CHART_TYPE_CHORD || series[i].type === ecConfig.CHART_TYPE_FORCE || series[i].type === ecConfig.CHART_TYPE_FUNNEL) {
                    data = series[i].categories || series[i].data || series[i].nodes;
                    for (var j = 0, k = data.length; j < k; j++) {
                        if (data[j].name === name) {
                            return {
                                type: series[i].type,
                                series: series[i],
                                seriesIndex: i,
                                data: data[j],
                                dataIndex: j
                            };
                        }
                    }
                }
            }
            return {
                type: 'bar',
                series: null,
                seriesIndex: -1,
                data: null,
                dataIndex: -1
            };
        },
        _getItemShapeByType: function (x, y, width, height, color, itemType, defaultColor) {
            var highlightColor = color === '#ccc' ? defaultColor : color;
            var itemShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    iconType: 'legendicon' + itemType,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    color: color,
                    strokeColor: color,
                    lineWidth: 2
                },
                highlightStyle: {
                    color: highlightColor,
                    strokeColor: highlightColor,
                    lineWidth: 1
                },
                hoverable: this.legendOption.selectedMode,
                clickable: this.legendOption.selectedMode
            };
            var imageLocation;
            if (itemType.match('image')) {
                var imageLocation = itemType.replace(new RegExp('^image:\\/\\/'), '');
                itemType = 'image';
            }
            switch (itemType) {
            case 'line':
                itemShape.style.brushType = 'stroke';
                itemShape.highlightStyle.lineWidth = 3;
                break;
            case 'radar':
            case 'scatter':
                itemShape.highlightStyle.lineWidth = 3;
                break;
            case 'k':
                itemShape.style.brushType = 'both';
                itemShape.highlightStyle.lineWidth = 3;
                itemShape.highlightStyle.color = itemShape.style.color = this.deepQuery([
                    this.ecTheme,
                    ecConfig
                ], 'k.itemStyle.normal.color') || '#fff';
                itemShape.style.strokeColor = color != '#ccc' ? this.deepQuery([
                    this.ecTheme,
                    ecConfig
                ], 'k.itemStyle.normal.lineStyle.color') || '#ff3200' : color;
                break;
            case 'image':
                itemShape.style.iconType = 'image';
                itemShape.style.image = imageLocation;
                if (color === '#ccc') {
                    itemShape.style.opacity = 0.5;
                }
                break;
            }
            return itemShape;
        },
        __legendSelected: function (param) {
            var itemName = param.target._name;
            if (this.legendOption.selectedMode === 'single') {
                for (var k in this._selectedMap) {
                    this._selectedMap[k] = false;
                }
            }
            this._selectedMap[itemName] = !this._selectedMap[itemName];
            this.messageCenter.dispatch(ecConfig.EVENT.LEGEND_SELECTED, param.event, {
                selected: this._selectedMap,
                target: itemName
            }, this.myChart);
        },
        __dispatchHoverLink: function (param) {
            this.messageCenter.dispatch(ecConfig.EVENT.LEGEND_HOVERLINK, param.event, { target: param.target._name }, this.myChart);
            return;
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption || this.option;
                this.option.legend = this.reformOption(this.option.legend);
                this.legendOption = this.option.legend;
                var data = this.legendOption.data || [];
                var itemName;
                var something;
                var color;
                var queryTarget;
                if (this.legendOption.selected) {
                    for (var k in this.legendOption.selected) {
                        this._selectedMap[k] = typeof this._selectedMap[k] != 'undefined' ? this._selectedMap[k] : this.legendOption.selected[k];
                    }
                }
                for (var i = 0, dataLength = data.length; i < dataLength; i++) {
                    itemName = this._getName(data[i]);
                    if (itemName === '') {
                        continue;
                    }
                    something = this._getSomethingByName(itemName);
                    if (!something.series) {
                        this._hasDataMap[itemName] = false;
                    } else {
                        this._hasDataMap[itemName] = true;
                        if (something.data && (something.type === ecConfig.CHART_TYPE_PIE || something.type === ecConfig.CHART_TYPE_FORCE || something.type === ecConfig.CHART_TYPE_FUNNEL)) {
                            queryTarget = [
                                something.data,
                                something.series
                            ];
                        } else {
                            queryTarget = [something.series];
                        }
                        color = this.getItemStyleColor(this.deepQuery(queryTarget, 'itemStyle.normal.color'), something.seriesIndex, something.dataIndex, something.data);
                        if (color && something.type != ecConfig.CHART_TYPE_K) {
                            this.setColor(itemName, color);
                        }
                        this._selectedMap[itemName] = this._selectedMap[itemName] != null ? this._selectedMap[itemName] : true;
                    }
                }
            }
            this.clear();
            this._buildShape();
        },
        getRelatedAmount: function (name) {
            var amount = 0;
            var series = this.option.series;
            var data;
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].name === name) {
                    amount++;
                }
                if (series[i].type === ecConfig.CHART_TYPE_PIE || series[i].type === ecConfig.CHART_TYPE_RADAR || series[i].type === ecConfig.CHART_TYPE_CHORD || series[i].type === ecConfig.CHART_TYPE_FORCE || series[i].type === ecConfig.CHART_TYPE_FUNNEL) {
                    data = series[i].type != ecConfig.CHART_TYPE_FORCE ? series[i].data : series[i].categories;
                    for (var j = 0, k = data.length; j < k; j++) {
                        if (data[j].name === name && data[j].value != '-') {
                            amount++;
                        }
                    }
                }
            }
            return amount;
        },
        setColor: function (legendName, color) {
            this._colorMap[legendName] = color;
        },
        getColor: function (legendName) {
            if (!this._colorMap[legendName]) {
                this._colorMap[legendName] = this.zr.getColor(this._colorIndex++);
            }
            return this._colorMap[legendName];
        },
        hasColor: function (legendName) {
            return this._colorMap[legendName] ? this._colorMap[legendName] : false;
        },
        add: function (name, color) {
            var data = this.legendOption.data;
            for (var i = 0, dataLength = data.length; i < dataLength; i++) {
                if (this._getName(data[i]) === name) {
                    return;
                }
            }
            this.legendOption.data.push(name);
            this.setColor(name, color);
            this._selectedMap[name] = true;
            this._hasDataMap[name] = true;
        },
        del: function (name) {
            var data = this.legendOption.data;
            for (var i = 0, dataLength = data.length; i < dataLength; i++) {
                if (this._getName(data[i]) === name) {
                    return this.legendOption.data.splice(i, 1);
                }
            }
        },
        getItemShape: function (name) {
            if (name == null) {
                return;
            }
            var shape;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                shape = this.shapeList[i];
                if (shape._name === name && shape.type != 'text') {
                    return shape;
                }
            }
        },
        setItemShape: function (name, itemShape) {
            var shape;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                shape = this.shapeList[i];
                if (shape._name === name && shape.type != 'text') {
                    if (!this._selectedMap[name]) {
                        itemShape.style.color = '#ccc';
                        itemShape.style.strokeColor = '#ccc';
                    }
                    this.zr.modShape(shape.id, itemShape);
                }
            }
        },
        isSelected: function (itemName) {
            if (typeof this._selectedMap[itemName] != 'undefined') {
                return this._selectedMap[itemName];
            } else {
                return true;
            }
        },
        getSelectedMap: function () {
            return this._selectedMap;
        },
        setSelected: function (itemName, selectStatus) {
            if (this.legendOption.selectedMode === 'single') {
                for (var k in this._selectedMap) {
                    this._selectedMap[k] = false;
                }
            }
            this._selectedMap[itemName] = selectStatus;
            this.messageCenter.dispatch(ecConfig.EVENT.LEGEND_SELECTED, null, {
                selected: this._selectedMap,
                target: itemName
            }, this.myChart);
        },
        onlegendSelected: function (param, status) {
            var legendSelected = param.selected;
            for (var itemName in legendSelected) {
                if (this._selectedMap[itemName] != legendSelected[itemName]) {
                    status.needRefresh = true;
                }
                this._selectedMap[itemName] = legendSelected[itemName];
            }
            return;
        }
    };
    var legendIcon = {
        line: function (ctx, style) {
            var dy = style.height / 2;
            ctx.moveTo(style.x, style.y + dy);
            ctx.lineTo(style.x + style.width, style.y + dy);
        },
        pie: function (ctx, style) {
            var x = style.x;
            var y = style.y;
            var width = style.width;
            var height = style.height;
            SectorShape.prototype.buildPath(ctx, {
                x: x + width / 2,
                y: y + height + 2,
                r: height,
                r0: 6,
                startAngle: 45,
                endAngle: 135
            });
        },
        eventRiver: function (ctx, style) {
            var x = style.x;
            var y = style.y;
            var width = style.width;
            var height = style.height;
            ctx.moveTo(x, y + height);
            ctx.bezierCurveTo(x + width, y + height, x, y + 4, x + width, y + 4);
            ctx.lineTo(x + width, y);
            ctx.bezierCurveTo(x, y, x + width, y + height - 4, x, y + height - 4);
            ctx.lineTo(x, y + height);
        },
        k: function (ctx, style) {
            var x = style.x;
            var y = style.y;
            var width = style.width;
            var height = style.height;
            CandleShape.prototype.buildPath(ctx, {
                x: x + width / 2,
                y: [
                    y + 1,
                    y + 1,
                    y + height - 6,
                    y + height
                ],
                width: width - 6
            });
        },
        bar: function (ctx, style) {
            var x = style.x;
            var y = style.y + 1;
            var width = style.width;
            var height = style.height - 2;
            var r = 3;
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        },
        force: function (ctx, style) {
            IconShape.prototype.iconLibrary.circle(ctx, style);
        },
        radar: function (ctx, style) {
            var n = 6;
            var x = style.x + style.width / 2;
            var y = style.y + style.height / 2;
            var r = style.height / 2;
            var dStep = 2 * Math.PI / n;
            var deg = -Math.PI / 2;
            var xStart = x + r * Math.cos(deg);
            var yStart = y + r * Math.sin(deg);
            ctx.moveTo(xStart, yStart);
            deg += dStep;
            for (var i = 0, end = n - 1; i < end; i++) {
                ctx.lineTo(x + r * Math.cos(deg), y + r * Math.sin(deg));
                deg += dStep;
            }
            ctx.lineTo(xStart, yStart);
        }
    };
    legendIcon.chord = legendIcon.pie;
    legendIcon.map = legendIcon.bar;
    for (var k in legendIcon) {
        IconShape.prototype.iconLibrary['legendicon' + k] = legendIcon[k];
    }
    zrUtil.inherits(Legend, Base);
    require('../component').define('legend', Legend);
    return Legend;
});define('echarts/util/ecData', [], function () {
    function pack(shape, series, seriesIndex, data, dataIndex, name, special, special2) {
        var value;
        if (typeof data != 'undefined') {
            value = data.value == null ? data : data.value;
        }
        shape._echartsData = {
            '_series': series,
            '_seriesIndex': seriesIndex,
            '_data': data,
            '_dataIndex': dataIndex,
            '_name': name,
            '_value': value,
            '_special': special,
            '_special2': special2
        };
        return shape._echartsData;
    }
    function get(shape, key) {
        var data = shape._echartsData;
        if (!key) {
            return data;
        }
        switch (key) {
        case 'series':
        case 'seriesIndex':
        case 'data':
        case 'dataIndex':
        case 'name':
        case 'value':
        case 'special':
        case 'special2':
            return data && data['_' + key];
        }
        return null;
    }
    function set(shape, key, value) {
        shape._echartsData = shape._echartsData || {};
        switch (key) {
        case 'series':
        case 'seriesIndex':
        case 'data':
        case 'dataIndex':
        case 'name':
        case 'value':
        case 'special':
        case 'special2':
            shape._echartsData['_' + key] = value;
            break;
        }
    }
    function clone(source, target) {
        target._echartsData = {
            '_series': source._echartsData._series,
            '_seriesIndex': source._echartsData._seriesIndex,
            '_data': source._echartsData._data,
            '_dataIndex': source._echartsData._dataIndex,
            '_name': source._echartsData._name,
            '_value': source._echartsData._value,
            '_special': source._echartsData._special,
            '_special2': source._echartsData._special2
        };
    }
    return {
        pack: pack,
        set: set,
        get: get,
        clone: clone
    };
});define('echarts/chart', [], function () {
    var self = {};
    var _chartLibrary = {};
    self.define = function (name, clazz) {
        _chartLibrary[name] = clazz;
        return self;
    };
    self.get = function (name) {
        return _chartLibrary[name];
    };
    return self;
});define('zrender/tool/color', [
    'require',
    '../tool/util'
], function (require) {
    var util = require('../tool/util');
    var _ctx;
    var palette = [
        '#ff9277',
        ' #dddd00',
        ' #ffc877',
        ' #bbe3ff',
        ' #d5ffbb',
        '#bbbbff',
        ' #ddb000',
        ' #b0dd00',
        ' #e2bbff',
        ' #ffbbe3',
        '#ff7777',
        ' #ff9900',
        ' #83dd00',
        ' #77e3ff',
        ' #778fff',
        '#c877ff',
        ' #ff77ab',
        ' #ff6600',
        ' #aa8800',
        ' #77c7ff',
        '#ad77ff',
        ' #ff77ff',
        ' #dd0083',
        ' #777700',
        ' #00aa00',
        '#0088aa',
        ' #8400dd',
        ' #aa0088',
        ' #dd0000',
        ' #772e00'
    ];
    var _palette = palette;
    var highlightColor = 'rgba(255,255,0,0.5)';
    var _highlightColor = highlightColor;
    var colorRegExp = /^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+%?)?)\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+)?)%?\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+)?)%?\s*\))\s*$/i;
    var _nameColors = {
        aliceblue: '#f0f8ff',
        antiquewhite: '#faebd7',
        aqua: '#0ff',
        aquamarine: '#7fffd4',
        azure: '#f0ffff',
        beige: '#f5f5dc',
        bisque: '#ffe4c4',
        black: '#000',
        blanchedalmond: '#ffebcd',
        blue: '#00f',
        blueviolet: '#8a2be2',
        brown: '#a52a2a',
        burlywood: '#deb887',
        cadetblue: '#5f9ea0',
        chartreuse: '#7fff00',
        chocolate: '#d2691e',
        coral: '#ff7f50',
        cornflowerblue: '#6495ed',
        cornsilk: '#fff8dc',
        crimson: '#dc143c',
        cyan: '#0ff',
        darkblue: '#00008b',
        darkcyan: '#008b8b',
        darkgoldenrod: '#b8860b',
        darkgray: '#a9a9a9',
        darkgrey: '#a9a9a9',
        darkgreen: '#006400',
        darkkhaki: '#bdb76b',
        darkmagenta: '#8b008b',
        darkolivegreen: '#556b2f',
        darkorange: '#ff8c00',
        darkorchid: '#9932cc',
        darkred: '#8b0000',
        darksalmon: '#e9967a',
        darkseagreen: '#8fbc8f',
        darkslateblue: '#483d8b',
        darkslategray: '#2f4f4f',
        darkslategrey: '#2f4f4f',
        darkturquoise: '#00ced1',
        darkviolet: '#9400d3',
        deeppink: '#ff1493',
        deepskyblue: '#00bfff',
        dimgray: '#696969',
        dimgrey: '#696969',
        dodgerblue: '#1e90ff',
        firebrick: '#b22222',
        floralwhite: '#fffaf0',
        forestgreen: '#228b22',
        fuchsia: '#f0f',
        gainsboro: '#dcdcdc',
        ghostwhite: '#f8f8ff',
        gold: '#ffd700',
        goldenrod: '#daa520',
        gray: '#808080',
        grey: '#808080',
        green: '#008000',
        greenyellow: '#adff2f',
        honeydew: '#f0fff0',
        hotpink: '#ff69b4',
        indianred: '#cd5c5c',
        indigo: '#4b0082',
        ivory: '#fffff0',
        khaki: '#f0e68c',
        lavender: '#e6e6fa',
        lavenderblush: '#fff0f5',
        lawngreen: '#7cfc00',
        lemonchiffon: '#fffacd',
        lightblue: '#add8e6',
        lightcoral: '#f08080',
        lightcyan: '#e0ffff',
        lightgoldenrodyellow: '#fafad2',
        lightgray: '#d3d3d3',
        lightgrey: '#d3d3d3',
        lightgreen: '#90ee90',
        lightpink: '#ffb6c1',
        lightsalmon: '#ffa07a',
        lightseagreen: '#20b2aa',
        lightskyblue: '#87cefa',
        lightslategray: '#789',
        lightslategrey: '#789',
        lightsteelblue: '#b0c4de',
        lightyellow: '#ffffe0',
        lime: '#0f0',
        limegreen: '#32cd32',
        linen: '#faf0e6',
        magenta: '#f0f',
        maroon: '#800000',
        mediumaquamarine: '#66cdaa',
        mediumblue: '#0000cd',
        mediumorchid: '#ba55d3',
        mediumpurple: '#9370d8',
        mediumseagreen: '#3cb371',
        mediumslateblue: '#7b68ee',
        mediumspringgreen: '#00fa9a',
        mediumturquoise: '#48d1cc',
        mediumvioletred: '#c71585',
        midnightblue: '#191970',
        mintcream: '#f5fffa',
        mistyrose: '#ffe4e1',
        moccasin: '#ffe4b5',
        navajowhite: '#ffdead',
        navy: '#000080',
        oldlace: '#fdf5e6',
        olive: '#808000',
        olivedrab: '#6b8e23',
        orange: '#ffa500',
        orangered: '#ff4500',
        orchid: '#da70d6',
        palegoldenrod: '#eee8aa',
        palegreen: '#98fb98',
        paleturquoise: '#afeeee',
        palevioletred: '#d87093',
        papayawhip: '#ffefd5',
        peachpuff: '#ffdab9',
        peru: '#cd853f',
        pink: '#ffc0cb',
        plum: '#dda0dd',
        powderblue: '#b0e0e6',
        purple: '#800080',
        red: '#f00',
        rosybrown: '#bc8f8f',
        royalblue: '#4169e1',
        saddlebrown: '#8b4513',
        salmon: '#fa8072',
        sandybrown: '#f4a460',
        seagreen: '#2e8b57',
        seashell: '#fff5ee',
        sienna: '#a0522d',
        silver: '#c0c0c0',
        skyblue: '#87ceeb',
        slateblue: '#6a5acd',
        slategray: '#708090',
        slategrey: '#708090',
        snow: '#fffafa',
        springgreen: '#00ff7f',
        steelblue: '#4682b4',
        tan: '#d2b48c',
        teal: '#008080',
        thistle: '#d8bfd8',
        tomato: '#ff6347',
        turquoise: '#40e0d0',
        violet: '#ee82ee',
        wheat: '#f5deb3',
        white: '#fff',
        whitesmoke: '#f5f5f5',
        yellow: '#ff0',
        yellowgreen: '#9acd32'
    };
    function customPalette(userPalete) {
        palette = userPalete;
    }
    function resetPalette() {
        palette = _palette;
    }
    function getColor(idx, userPalete) {
        idx = idx | 0;
        userPalete = userPalete || palette;
        return userPalete[idx % userPalete.length];
    }
    function customHighlight(userHighlightColor) {
        highlightColor = userHighlightColor;
    }
    function resetHighlight() {
        _highlightColor = highlightColor;
    }
    function getHighlightColor() {
        return highlightColor;
    }
    function getRadialGradient(x0, y0, r0, x1, y1, r1, colorList) {
        if (!_ctx) {
            _ctx = util.getContext();
        }
        var gradient = _ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        for (var i = 0, l = colorList.length; i < l; i++) {
            gradient.addColorStop(colorList[i][0], colorList[i][1]);
        }
        gradient.__nonRecursion = true;
        return gradient;
    }
    function getLinearGradient(x0, y0, x1, y1, colorList) {
        if (!_ctx) {
            _ctx = util.getContext();
        }
        var gradient = _ctx.createLinearGradient(x0, y0, x1, y1);
        for (var i = 0, l = colorList.length; i < l; i++) {
            gradient.addColorStop(colorList[i][0], colorList[i][1]);
        }
        gradient.__nonRecursion = true;
        return gradient;
    }
    function getStepColors(start, end, step) {
        start = toRGBA(start);
        end = toRGBA(end);
        start = getData(start);
        end = getData(end);
        var colors = [];
        var stepR = (end[0] - start[0]) / step;
        var stepG = (end[1] - start[1]) / step;
        var stepB = (end[2] - start[2]) / step;
        var stepA = (end[3] - start[3]) / step;
        for (var i = 0, r = start[0], g = start[1], b = start[2], a = start[3]; i < step; i++) {
            colors[i] = toColor([
                adjust(Math.floor(r), [
                    0,
                    255
                ]),
                adjust(Math.floor(g), [
                    0,
                    255
                ]),
                adjust(Math.floor(b), [
                    0,
                    255
                ]),
                a.toFixed(4) - 0
            ], 'rgba');
            r += stepR;
            g += stepG;
            b += stepB;
            a += stepA;
        }
        r = end[0];
        g = end[1];
        b = end[2];
        a = end[3];
        colors[i] = toColor([
            r,
            g,
            b,
            a
        ], 'rgba');
        return colors;
    }
    function getGradientColors(colors, step) {
        var ret = [];
        var len = colors.length;
        if (step === undefined) {
            step = 20;
        }
        if (len === 1) {
            ret = getStepColors(colors[0], colors[0], step);
        } else if (len > 1) {
            for (var i = 0, n = len - 1; i < n; i++) {
                var steps = getStepColors(colors[i], colors[i + 1], step);
                if (i < n - 1) {
                    steps.pop();
                }
                ret = ret.concat(steps);
            }
        }
        return ret;
    }
    function toColor(data, format) {
        format = format || 'rgb';
        if (data && (data.length === 3 || data.length === 4)) {
            data = map(data, function (c) {
                return c > 1 ? Math.ceil(c) : c;
            });
            if (format.indexOf('hex') > -1) {
                return '#' + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + +data[2]).toString(16).slice(1);
            } else if (format.indexOf('hs') > -1) {
                var sx = map(data.slice(1, 3), function (c) {
                    return c + '%';
                });
                data[1] = sx[0];
                data[2] = sx[1];
            }
            if (format.indexOf('a') > -1) {
                if (data.length === 3) {
                    data.push(1);
                }
                data[3] = adjust(data[3], [
                    0,
                    1
                ]);
                return format + '(' + data.slice(0, 4).join(',') + ')';
            }
            return format + '(' + data.slice(0, 3).join(',') + ')';
        }
    }
    function toArray(color) {
        color = trim(color);
        if (color.indexOf('rgba') < 0) {
            color = toRGBA(color);
        }
        var data = [];
        var i = 0;
        color.replace(/[\d.]+/g, function (n) {
            if (i < 3) {
                n = n | 0;
            } else {
                n = +n;
            }
            data[i++] = n;
        });
        return data;
    }
    function convert(color, format) {
        if (!isCalculableColor(color)) {
            return color;
        }
        var data = getData(color);
        var alpha = data[3];
        if (typeof alpha === 'undefined') {
            alpha = 1;
        }
        if (color.indexOf('hsb') > -1) {
            data = _HSV_2_RGB(data);
        } else if (color.indexOf('hsl') > -1) {
            data = _HSL_2_RGB(data);
        }
        if (format.indexOf('hsb') > -1 || format.indexOf('hsv') > -1) {
            data = _RGB_2_HSB(data);
        } else if (format.indexOf('hsl') > -1) {
            data = _RGB_2_HSL(data);
        }
        data[3] = alpha;
        return toColor(data, format);
    }
    function toRGBA(color) {
        return convert(color, 'rgba');
    }
    function toRGB(color) {
        return convert(color, 'rgb');
    }
    function toHex(color) {
        return convert(color, 'hex');
    }
    function toHSVA(color) {
        return convert(color, 'hsva');
    }
    function toHSV(color) {
        return convert(color, 'hsv');
    }
    function toHSBA(color) {
        return convert(color, 'hsba');
    }
    function toHSB(color) {
        return convert(color, 'hsb');
    }
    function toHSLA(color) {
        return convert(color, 'hsla');
    }
    function toHSL(color) {
        return convert(color, 'hsl');
    }
    function toName(color) {
        for (var key in _nameColors) {
            if (toHex(_nameColors[key]) === toHex(color)) {
                return key;
            }
        }
        return null;
    }
    function trim(color) {
        return String(color).replace(/\s+/g, '');
    }
    function normalize(color) {
        if (_nameColors[color]) {
            color = _nameColors[color];
        }
        color = trim(color);
        color = color.replace(/hsv/i, 'hsb');
        if (/^#[\da-f]{3}$/i.test(color)) {
            color = parseInt(color.slice(1), 16);
            var r = (color & 3840) << 8;
            var g = (color & 240) << 4;
            var b = color & 15;
            color = '#' + ((1 << 24) + (r << 4) + r + (g << 4) + g + (b << 4) + b).toString(16).slice(1);
        }
        return color;
    }
    function lift(color, level) {
        if (!isCalculableColor(color)) {
            return color;
        }
        var direct = level > 0 ? 1 : -1;
        if (typeof level === 'undefined') {
            level = 0;
        }
        level = Math.abs(level) > 1 ? 1 : Math.abs(level);
        color = toRGB(color);
        var data = getData(color);
        for (var i = 0; i < 3; i++) {
            if (direct === 1) {
                data[i] = data[i] * (1 - level) | 0;
            } else {
                data[i] = (255 - data[i]) * level + data[i] | 0;
            }
        }
        return 'rgb(' + data.join(',') + ')';
    }
    function reverse(color) {
        if (!isCalculableColor(color)) {
            return color;
        }
        var data = getData(toRGBA(color));
        data = map(data, function (c) {
            return 255 - c;
        });
        return toColor(data, 'rgb');
    }
    function mix(color1, color2, weight) {
        if (!isCalculableColor(color1) || !isCalculableColor(color2)) {
            return color1;
        }
        if (typeof weight === 'undefined') {
            weight = 0.5;
        }
        weight = 1 - adjust(weight, [
            0,
            1
        ]);
        var w = weight * 2 - 1;
        var data1 = getData(toRGBA(color1));
        var data2 = getData(toRGBA(color2));
        var d = data1[3] - data2[3];
        var weight1 = ((w * d === -1 ? w : (w + d) / (1 + w * d)) + 1) / 2;
        var weight2 = 1 - weight1;
        var data = [];
        for (var i = 0; i < 3; i++) {
            data[i] = data1[i] * weight1 + data2[i] * weight2;
        }
        var alpha = data1[3] * weight + data2[3] * (1 - weight);
        alpha = Math.max(0, Math.min(1, alpha));
        if (data1[3] === 1 && data2[3] === 1) {
            return toColor(data, 'rgb');
        }
        data[3] = alpha;
        return toColor(data, 'rgba');
    }
    function random() {
        return '#' + (Math.random().toString(16) + '0000').slice(2, 8);
    }
    function getData(color) {
        color = normalize(color);
        var r = color.match(colorRegExp);
        if (r === null) {
            throw new Error('The color format error');
        }
        var d;
        var a;
        var data = [];
        var rgb;
        if (r[2]) {
            d = r[2].replace('#', '').split('');
            rgb = [
                d[0] + d[1],
                d[2] + d[3],
                d[4] + d[5]
            ];
            data = map(rgb, function (c) {
                return adjust(parseInt(c, 16), [
                    0,
                    255
                ]);
            });
        } else if (r[4]) {
            var rgba = r[4].split(',');
            a = rgba[3];
            rgb = rgba.slice(0, 3);
            data = map(rgb, function (c) {
                c = Math.floor(c.indexOf('%') > 0 ? parseInt(c, 0) * 2.55 : c);
                return adjust(c, [
                    0,
                    255
                ]);
            });
            if (typeof a !== 'undefined') {
                data.push(adjust(parseFloat(a), [
                    0,
                    1
                ]));
            }
        } else if (r[5] || r[6]) {
            var hsxa = (r[5] || r[6]).split(',');
            var h = parseInt(hsxa[0], 0) / 360;
            var s = hsxa[1];
            var x = hsxa[2];
            a = hsxa[3];
            data = map([
                s,
                x
            ], function (c) {
                return adjust(parseFloat(c) / 100, [
                    0,
                    1
                ]);
            });
            data.unshift(h);
            if (typeof a !== 'undefined') {
                data.push(adjust(parseFloat(a), [
                    0,
                    1
                ]));
            }
        }
        return data;
    }
    function alpha(color, a) {
        if (!isCalculableColor(color)) {
            return color;
        }
        if (a === null) {
            a = 1;
        }
        var data = getData(toRGBA(color));
        data[3] = adjust(Number(a).toFixed(4), [
            0,
            1
        ]);
        return toColor(data, 'rgba');
    }
    function map(array, fun) {
        if (typeof fun !== 'function') {
            throw new TypeError();
        }
        var len = array ? array.length : 0;
        for (var i = 0; i < len; i++) {
            array[i] = fun(array[i]);
        }
        return array;
    }
    function adjust(value, region) {
        if (value <= region[0]) {
            value = region[0];
        } else if (value >= region[1]) {
            value = region[1];
        }
        return value;
    }
    function isCalculableColor(color) {
        return color instanceof Array || typeof color === 'string';
    }
    function _HSV_2_RGB(data) {
        var H = data[0];
        var S = data[1];
        var V = data[2];
        var R;
        var G;
        var B;
        if (S === 0) {
            R = V * 255;
            G = V * 255;
            B = V * 255;
        } else {
            var h = H * 6;
            if (h === 6) {
                h = 0;
            }
            var i = h | 0;
            var v1 = V * (1 - S);
            var v2 = V * (1 - S * (h - i));
            var v3 = V * (1 - S * (1 - (h - i)));
            var r = 0;
            var g = 0;
            var b = 0;
            if (i === 0) {
                r = V;
                g = v3;
                b = v1;
            } else if (i === 1) {
                r = v2;
                g = V;
                b = v1;
            } else if (i === 2) {
                r = v1;
                g = V;
                b = v3;
            } else if (i === 3) {
                r = v1;
                g = v2;
                b = V;
            } else if (i === 4) {
                r = v3;
                g = v1;
                b = V;
            } else {
                r = V;
                g = v1;
                b = v2;
            }
            R = r * 255;
            G = g * 255;
            B = b * 255;
        }
        return [
            R,
            G,
            B
        ];
    }
    function _HSL_2_RGB(data) {
        var H = data[0];
        var S = data[1];
        var L = data[2];
        var R;
        var G;
        var B;
        if (S === 0) {
            R = L * 255;
            G = L * 255;
            B = L * 255;
        } else {
            var v2;
            if (L < 0.5) {
                v2 = L * (1 + S);
            } else {
                v2 = L + S - S * L;
            }
            var v1 = 2 * L - v2;
            R = 255 * _HUE_2_RGB(v1, v2, H + 1 / 3);
            G = 255 * _HUE_2_RGB(v1, v2, H);
            B = 255 * _HUE_2_RGB(v1, v2, H - 1 / 3);
        }
        return [
            R,
            G,
            B
        ];
    }
    function _HUE_2_RGB(v1, v2, vH) {
        if (vH < 0) {
            vH += 1;
        }
        if (vH > 1) {
            vH -= 1;
        }
        if (6 * vH < 1) {
            return v1 + (v2 - v1) * 6 * vH;
        }
        if (2 * vH < 1) {
            return v2;
        }
        if (3 * vH < 2) {
            return v1 + (v2 - v1) * (2 / 3 - vH) * 6;
        }
        return v1;
    }
    function _RGB_2_HSB(data) {
        var R = data[0] / 255;
        var G = data[1] / 255;
        var B = data[2] / 255;
        var vMin = Math.min(R, G, B);
        var vMax = Math.max(R, G, B);
        var delta = vMax - vMin;
        var V = vMax;
        var H;
        var S;
        if (delta === 0) {
            H = 0;
            S = 0;
        } else {
            S = delta / vMax;
            var deltaR = ((vMax - R) / 6 + delta / 2) / delta;
            var deltaG = ((vMax - G) / 6 + delta / 2) / delta;
            var deltaB = ((vMax - B) / 6 + delta / 2) / delta;
            if (R === vMax) {
                H = deltaB - deltaG;
            } else if (G === vMax) {
                H = 1 / 3 + deltaR - deltaB;
            } else if (B === vMax) {
                H = 2 / 3 + deltaG - deltaR;
            }
            if (H < 0) {
                H += 1;
            }
            if (H > 1) {
                H -= 1;
            }
        }
        H = H * 360;
        S = S * 100;
        V = V * 100;
        return [
            H,
            S,
            V
        ];
    }
    function _RGB_2_HSL(data) {
        var R = data[0] / 255;
        var G = data[1] / 255;
        var B = data[2] / 255;
        var vMin = Math.min(R, G, B);
        var vMax = Math.max(R, G, B);
        var delta = vMax - vMin;
        var L = (vMax + vMin) / 2;
        var H;
        var S;
        if (delta === 0) {
            H = 0;
            S = 0;
        } else {
            if (L < 0.5) {
                S = delta / (vMax + vMin);
            } else {
                S = delta / (2 - vMax - vMin);
            }
            var deltaR = ((vMax - R) / 6 + delta / 2) / delta;
            var deltaG = ((vMax - G) / 6 + delta / 2) / delta;
            var deltaB = ((vMax - B) / 6 + delta / 2) / delta;
            if (R === vMax) {
                H = deltaB - deltaG;
            } else if (G === vMax) {
                H = 1 / 3 + deltaR - deltaB;
            } else if (B === vMax) {
                H = 2 / 3 + deltaG - deltaR;
            }
            if (H < 0) {
                H += 1;
            }
            if (H > 1) {
                H -= 1;
            }
        }
        H = H * 360;
        S = S * 100;
        L = L * 100;
        return [
            H,
            S,
            L
        ];
    }
    return {
        customPalette: customPalette,
        resetPalette: resetPalette,
        getColor: getColor,
        getHighlightColor: getHighlightColor,
        customHighlight: customHighlight,
        resetHighlight: resetHighlight,
        getRadialGradient: getRadialGradient,
        getLinearGradient: getLinearGradient,
        getGradientColors: getGradientColors,
        getStepColors: getStepColors,
        reverse: reverse,
        mix: mix,
        lift: lift,
        trim: trim,
        random: random,
        toRGB: toRGB,
        toRGBA: toRGBA,
        toHex: toHex,
        toHSL: toHSL,
        toHSLA: toHSLA,
        toHSB: toHSB,
        toHSBA: toHSBA,
        toHSV: toHSV,
        toHSVA: toHSVA,
        toName: toName,
        toColor: toColor,
        toArray: toArray,
        alpha: alpha,
        getData: getData
    };
});define('echarts/component/timeline', [
    'require',
    './base',
    'zrender/shape/Rectangle',
    '../util/shape/Icon',
    '../util/shape/Chain',
    '../config',
    'zrender/tool/util',
    'zrender/tool/area',
    'zrender/tool/event',
    '../component'
], function (require) {
    var Base = require('./base');
    var RectangleShape = require('zrender/shape/Rectangle');
    var IconShape = require('../util/shape/Icon');
    var ChainShape = require('../util/shape/Chain');
    var ecConfig = require('../config');
    ecConfig.timeline = {
        zlevel: 0,
        z: 4,
        show: true,
        type: 'time',
        notMerge: false,
        realtime: true,
        x: 80,
        x2: 80,
        y2: 0,
        height: 50,
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        controlPosition: 'left',
        autoPlay: false,
        loop: true,
        playInterval: 2000,
        lineStyle: {
            width: 1,
            color: '#666',
            type: 'dashed'
        },
        label: {
            show: true,
            interval: 'auto',
            rotate: 0,
            textStyle: { color: '#333' }
        },
        checkpointStyle: {
            symbol: 'auto',
            symbolSize: 'auto',
            color: 'auto',
            borderColor: 'auto',
            borderWidth: 'auto',
            label: {
                show: false,
                textStyle: { color: 'auto' }
            }
        },
        controlStyle: {
            itemSize: 15,
            itemGap: 5,
            normal: { color: '#333' },
            emphasis: { color: '#1e90ff' }
        },
        symbol: 'emptyDiamond',
        symbolSize: 4,
        currentIndex: 0
    };
    var zrUtil = require('zrender/tool/util');
    var zrArea = require('zrender/tool/area');
    var zrEvent = require('zrender/tool/event');
    function Timeline(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        var self = this;
        self._onclick = function (param) {
            return self.__onclick(param);
        };
        self._ondrift = function (dx, dy) {
            return self.__ondrift(this, dx, dy);
        };
        self._ondragend = function () {
            return self.__ondragend();
        };
        self._setCurrentOption = function () {
            var timelineOption = self.timelineOption;
            self.currentIndex %= timelineOption.data.length;
            var curOption = self.options[self.currentIndex] || {};
            self.myChart.setOption(curOption, timelineOption.notMerge);
            self.messageCenter.dispatch(ecConfig.EVENT.TIMELINE_CHANGED, null, {
                currentIndex: self.currentIndex,
                data: timelineOption.data[self.currentIndex].name != null ? timelineOption.data[self.currentIndex].name : timelineOption.data[self.currentIndex]
            }, self.myChart);
        };
        self._onFrame = function () {
            self._setCurrentOption();
            self._syncHandleShape();
            if (self.timelineOption.autoPlay) {
                self.playTicket = setTimeout(function () {
                    self.currentIndex += 1;
                    if (!self.timelineOption.loop && self.currentIndex >= self.timelineOption.data.length) {
                        self.currentIndex = self.timelineOption.data.length - 1;
                        self.stop();
                        return;
                    }
                    self._onFrame();
                }, self.timelineOption.playInterval);
            }
        };
        this.setTheme(false);
        this.options = this.option.options;
        this.currentIndex = this.timelineOption.currentIndex % this.timelineOption.data.length;
        if (!this.timelineOption.notMerge && this.currentIndex !== 0) {
            this.options[this.currentIndex] = zrUtil.merge(this.options[this.currentIndex], this.options[0]);
        }
        if (this.timelineOption.show) {
            this._buildShape();
            this._syncHandleShape();
        }
        this._setCurrentOption();
        if (this.timelineOption.autoPlay) {
            var self = this;
            this.playTicket = setTimeout(function () {
                self.play();
            }, this.ecTheme.animationDuration != null ? this.ecTheme.animationDuration : ecConfig.animationDuration);
        }
    }
    Timeline.prototype = {
        type: ecConfig.COMPONENT_TYPE_TIMELINE,
        _buildShape: function () {
            this._location = this._getLocation();
            this._buildBackground();
            this._buildControl();
            this._chainPoint = this._getChainPoint();
            if (this.timelineOption.label.show) {
                var interval = this._getInterval();
                for (var i = 0, len = this._chainPoint.length; i < len; i += interval) {
                    this._chainPoint[i].showLabel = true;
                }
            }
            this._buildChain();
            this._buildHandle();
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },
        _getLocation: function () {
            var timelineOption = this.timelineOption;
            var padding = this.reformCssArray(this.timelineOption.padding);
            var zrWidth = this.zr.getWidth();
            var x = this.parsePercent(timelineOption.x, zrWidth);
            var x2 = this.parsePercent(timelineOption.x2, zrWidth);
            var width;
            if (timelineOption.width == null) {
                width = zrWidth - x - x2;
                x2 = zrWidth - x2;
            } else {
                width = this.parsePercent(timelineOption.width, zrWidth);
                x2 = x + width;
            }
            var zrHeight = this.zr.getHeight();
            var height = this.parsePercent(timelineOption.height, zrHeight);
            var y;
            var y2;
            if (timelineOption.y != null) {
                y = this.parsePercent(timelineOption.y, zrHeight);
                y2 = y + height;
            } else {
                y2 = zrHeight - this.parsePercent(timelineOption.y2, zrHeight);
                y = y2 - height;
            }
            return {
                x: x + padding[3],
                y: y + padding[0],
                x2: x2 - padding[1],
                y2: y2 - padding[2],
                width: width - padding[1] - padding[3],
                height: height - padding[0] - padding[2]
            };
        },
        _getReformedLabel: function (idx) {
            var timelineOption = this.timelineOption;
            var data = timelineOption.data[idx].name != null ? timelineOption.data[idx].name : timelineOption.data[idx];
            var formatter = timelineOption.data[idx].formatter || timelineOption.label.formatter;
            if (formatter) {
                if (typeof formatter === 'function') {
                    data = formatter.call(this.myChart, data);
                } else if (typeof formatter === 'string') {
                    data = formatter.replace('{value}', data);
                }
            }
            return data;
        },
        _getInterval: function () {
            var chainPoint = this._chainPoint;
            var timelineOption = this.timelineOption;
            var interval = timelineOption.label.interval;
            if (interval === 'auto') {
                var fontSize = timelineOption.label.textStyle.fontSize;
                var data = timelineOption.data;
                var dataLength = timelineOption.data.length;
                if (dataLength > 3) {
                    var isEnough = false;
                    var labelSpace;
                    var labelSize;
                    interval = 0;
                    while (!isEnough && interval < dataLength) {
                        interval++;
                        isEnough = true;
                        for (var i = interval; i < dataLength; i += interval) {
                            labelSpace = chainPoint[i].x - chainPoint[i - interval].x;
                            if (timelineOption.label.rotate !== 0) {
                                labelSize = fontSize;
                            } else if (data[i].textStyle) {
                                labelSize = zrArea.getTextWidth(chainPoint[i].name, chainPoint[i].textFont);
                            } else {
                                var label = chainPoint[i].name + '';
                                var wLen = (label.match(/\w/g) || '').length;
                                var oLen = label.length - wLen;
                                labelSize = wLen * fontSize * 2 / 3 + oLen * fontSize;
                            }
                            if (labelSpace < labelSize) {
                                isEnough = false;
                                break;
                            }
                        }
                    }
                } else {
                    interval = 1;
                }
            } else {
                interval = interval - 0 + 1;
            }
            return interval;
        },
        _getChainPoint: function () {
            var timelineOption = this.timelineOption;
            var symbol = timelineOption.symbol.toLowerCase();
            var symbolSize = timelineOption.symbolSize;
            var rotate = timelineOption.label.rotate;
            var textStyle = timelineOption.label.textStyle;
            var textFont = this.getFont(textStyle);
            var dataTextStyle;
            var data = timelineOption.data;
            var x = this._location.x;
            var y = this._location.y + this._location.height / 4 * 3;
            var width = this._location.x2 - this._location.x;
            var len = data.length;
            function _getName(i) {
                return data[i].name != null ? data[i].name : data[i] + '';
            }
            var xList = [];
            if (len > 1) {
                var boundaryGap = width / len;
                boundaryGap = boundaryGap > 50 ? 50 : boundaryGap < 20 ? 5 : boundaryGap;
                width -= boundaryGap * 2;
                if (timelineOption.type === 'number') {
                    for (var i = 0; i < len; i++) {
                        xList.push(x + boundaryGap + width / (len - 1) * i);
                    }
                } else {
                    xList[0] = new Date(_getName(0).replace(/-/g, '/'));
                    xList[len - 1] = new Date(_getName(len - 1).replace(/-/g, '/')) - xList[0];
                    for (var i = 1; i < len; i++) {
                        xList[i] = x + boundaryGap + width * (new Date(_getName(i).replace(/-/g, '/')) - xList[0]) / xList[len - 1];
                    }
                    xList[0] = x + boundaryGap;
                }
            } else {
                xList.push(x + width / 2);
            }
            var list = [];
            var curSymbol;
            var n;
            var isEmpty;
            var textAlign;
            var rotation;
            for (var i = 0; i < len; i++) {
                x = xList[i];
                curSymbol = data[i].symbol && data[i].symbol.toLowerCase() || symbol;
                if (curSymbol.match('empty')) {
                    curSymbol = curSymbol.replace('empty', '');
                    isEmpty = true;
                } else {
                    isEmpty = false;
                }
                if (curSymbol.match('star')) {
                    n = curSymbol.replace('star', '') - 0 || 5;
                    curSymbol = 'star';
                }
                dataTextStyle = data[i].textStyle ? zrUtil.merge(data[i].textStyle || {}, textStyle) : textStyle;
                textAlign = dataTextStyle.align || 'center';
                if (rotate) {
                    textAlign = rotate > 0 ? 'right' : 'left';
                    rotation = [
                        rotate * Math.PI / 180,
                        x,
                        y - 5
                    ];
                } else {
                    rotation = false;
                }
                list.push({
                    x: x,
                    n: n,
                    isEmpty: isEmpty,
                    symbol: curSymbol,
                    symbolSize: data[i].symbolSize || symbolSize,
                    color: data[i].color,
                    borderColor: data[i].borderColor,
                    borderWidth: data[i].borderWidth,
                    name: this._getReformedLabel(i),
                    textColor: dataTextStyle.color,
                    textAlign: textAlign,
                    textBaseline: dataTextStyle.baseline || 'middle',
                    textX: x,
                    textY: y - (rotate ? 5 : 0),
                    textFont: data[i].textStyle ? this.getFont(dataTextStyle) : textFont,
                    rotation: rotation,
                    showLabel: false
                });
            }
            return list;
        },
        _buildBackground: function () {
            var timelineOption = this.timelineOption;
            var padding = this.reformCssArray(this.timelineOption.padding);
            var width = this._location.width;
            var height = this._location.height;
            if (timelineOption.borderWidth !== 0 || timelineOption.backgroundColor.replace(/\s/g, '') != 'rgba(0,0,0,0)') {
                this.shapeList.push(new RectangleShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    hoverable: false,
                    style: {
                        x: this._location.x - padding[3],
                        y: this._location.y - padding[0],
                        width: width + padding[1] + padding[3],
                        height: height + padding[0] + padding[2],
                        brushType: timelineOption.borderWidth === 0 ? 'fill' : 'both',
                        color: timelineOption.backgroundColor,
                        strokeColor: timelineOption.borderColor,
                        lineWidth: timelineOption.borderWidth
                    }
                }));
            }
        },
        _buildControl: function () {
            var self = this;
            var timelineOption = this.timelineOption;
            var lineStyle = timelineOption.lineStyle;
            var controlStyle = timelineOption.controlStyle;
            if (timelineOption.controlPosition === 'none') {
                return;
            }
            var iconSize = controlStyle.itemSize;
            var iconGap = controlStyle.itemGap;
            var x;
            if (timelineOption.controlPosition === 'left') {
                x = this._location.x;
                this._location.x += (iconSize + iconGap) * 3;
            } else {
                x = this._location.x2 - ((iconSize + iconGap) * 3 - iconGap);
                this._location.x2 -= (iconSize + iconGap) * 3;
            }
            var y = this._location.y;
            var iconStyle = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                style: {
                    iconType: 'timelineControl',
                    symbol: 'last',
                    x: x,
                    y: y,
                    width: iconSize,
                    height: iconSize,
                    brushType: 'stroke',
                    color: controlStyle.normal.color,
                    strokeColor: controlStyle.normal.color,
                    lineWidth: lineStyle.width
                },
                highlightStyle: {
                    color: controlStyle.emphasis.color,
                    strokeColor: controlStyle.emphasis.color,
                    lineWidth: lineStyle.width + 1
                },
                clickable: true
            };
            this._ctrLastShape = new IconShape(iconStyle);
            this._ctrLastShape.onclick = function () {
                self.last();
            };
            this.shapeList.push(this._ctrLastShape);
            x += iconSize + iconGap;
            this._ctrPlayShape = new IconShape(zrUtil.clone(iconStyle));
            this._ctrPlayShape.style.brushType = 'fill';
            this._ctrPlayShape.style.symbol = 'play';
            this._ctrPlayShape.style.status = this.timelineOption.autoPlay ? 'playing' : 'stop';
            this._ctrPlayShape.style.x = x;
            this._ctrPlayShape.onclick = function () {
                if (self._ctrPlayShape.style.status === 'stop') {
                    self.play();
                } else {
                    self.stop();
                }
            };
            this.shapeList.push(this._ctrPlayShape);
            x += iconSize + iconGap;
            this._ctrNextShape = new IconShape(zrUtil.clone(iconStyle));
            this._ctrNextShape.style.symbol = 'next';
            this._ctrNextShape.style.x = x;
            this._ctrNextShape.onclick = function () {
                self.next();
            };
            this.shapeList.push(this._ctrNextShape);
        },
        _buildChain: function () {
            var timelineOption = this.timelineOption;
            var lineStyle = timelineOption.lineStyle;
            this._timelineShae = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: this._location.x,
                    y: this.subPixelOptimize(this._location.y, lineStyle.width),
                    width: this._location.x2 - this._location.x,
                    height: this._location.height,
                    chainPoint: this._chainPoint,
                    brushType: 'both',
                    strokeColor: lineStyle.color,
                    lineWidth: lineStyle.width,
                    lineType: lineStyle.type
                },
                hoverable: false,
                clickable: true,
                onclick: this._onclick
            };
            this._timelineShae = new ChainShape(this._timelineShae);
            this.shapeList.push(this._timelineShae);
        },
        _buildHandle: function () {
            var curPoint = this._chainPoint[this.currentIndex];
            var symbolSize = curPoint.symbolSize + 1;
            symbolSize = symbolSize < 5 ? 5 : symbolSize;
            this._handleShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                hoverable: false,
                draggable: true,
                style: {
                    iconType: 'diamond',
                    n: curPoint.n,
                    x: curPoint.x - symbolSize,
                    y: this._location.y + this._location.height / 4 - symbolSize,
                    width: symbolSize * 2,
                    height: symbolSize * 2,
                    brushType: 'both',
                    textPosition: 'specific',
                    textX: curPoint.x,
                    textY: this._location.y - this._location.height / 4,
                    textAlign: 'center',
                    textBaseline: 'middle'
                },
                highlightStyle: {},
                ondrift: this._ondrift,
                ondragend: this._ondragend
            };
            this._handleShape = new IconShape(this._handleShape);
            this.shapeList.push(this._handleShape);
        },
        _syncHandleShape: function () {
            if (!this.timelineOption.show) {
                return;
            }
            var timelineOption = this.timelineOption;
            var cpStyle = timelineOption.checkpointStyle;
            var curPoint = this._chainPoint[this.currentIndex];
            this._handleShape.style.text = cpStyle.label.show ? curPoint.name : '';
            this._handleShape.style.textFont = curPoint.textFont;
            this._handleShape.style.n = curPoint.n;
            if (cpStyle.symbol === 'auto') {
                this._handleShape.style.iconType = curPoint.symbol != 'none' ? curPoint.symbol : 'diamond';
            } else {
                this._handleShape.style.iconType = cpStyle.symbol;
                if (cpStyle.symbol.match('star')) {
                    this._handleShape.style.n = cpStyle.symbol.replace('star', '') - 0 || 5;
                    this._handleShape.style.iconType = 'star';
                }
            }
            var symbolSize;
            if (cpStyle.symbolSize === 'auto') {
                symbolSize = curPoint.symbolSize + 2;
                symbolSize = symbolSize < 5 ? 5 : symbolSize;
            } else {
                symbolSize = cpStyle.symbolSize - 0;
            }
            this._handleShape.style.color = cpStyle.color === 'auto' ? curPoint.color ? curPoint.color : timelineOption.controlStyle.emphasis.color : cpStyle.color;
            this._handleShape.style.textColor = cpStyle.label.textStyle.color === 'auto' ? this._handleShape.style.color : cpStyle.label.textStyle.color;
            this._handleShape.highlightStyle.strokeColor = this._handleShape.style.strokeColor = cpStyle.borderColor === 'auto' ? curPoint.borderColor ? curPoint.borderColor : '#fff' : cpStyle.borderColor;
            this._handleShape.style.lineWidth = cpStyle.borderWidth === 'auto' ? curPoint.borderWidth ? curPoint.borderWidth : 0 : cpStyle.borderWidth - 0;
            this._handleShape.highlightStyle.lineWidth = this._handleShape.style.lineWidth + 1;
            this.zr.animate(this._handleShape.id, 'style').when(500, {
                x: curPoint.x - symbolSize,
                textX: curPoint.x,
                y: this._location.y + this._location.height / 4 - symbolSize,
                width: symbolSize * 2,
                height: symbolSize * 2
            }).start('ExponentialOut');
        },
        _findChainIndex: function (x) {
            var chainPoint = this._chainPoint;
            var len = chainPoint.length;
            if (x <= chainPoint[0].x) {
                return 0;
            } else if (x >= chainPoint[len - 1].x) {
                return len - 1;
            }
            for (var i = 0; i < len - 1; i++) {
                if (x >= chainPoint[i].x && x <= chainPoint[i + 1].x) {
                    return Math.abs(x - chainPoint[i].x) < Math.abs(x - chainPoint[i + 1].x) ? i : i + 1;
                }
            }
        },
        __onclick: function (param) {
            var x = zrEvent.getX(param.event);
            var newIndex = this._findChainIndex(x);
            if (newIndex === this.currentIndex) {
                return true;
            }
            this.currentIndex = newIndex;
            this.timelineOption.autoPlay && this.stop();
            clearTimeout(this.playTicket);
            this._onFrame();
        },
        __ondrift: function (shape, dx) {
            this.timelineOption.autoPlay && this.stop();
            var chainPoint = this._chainPoint;
            var len = chainPoint.length;
            var newIndex;
            if (shape.style.x + dx <= chainPoint[0].x - chainPoint[0].symbolSize) {
                shape.style.x = chainPoint[0].x - chainPoint[0].symbolSize;
                newIndex = 0;
            } else if (shape.style.x + dx >= chainPoint[len - 1].x - chainPoint[len - 1].symbolSize) {
                shape.style.x = chainPoint[len - 1].x - chainPoint[len - 1].symbolSize;
                newIndex = len - 1;
            } else {
                shape.style.x += dx;
                newIndex = this._findChainIndex(shape.style.x);
            }
            var curPoint = chainPoint[newIndex];
            var symbolSize = curPoint.symbolSize + 2;
            shape.style.iconType = curPoint.symbol;
            shape.style.n = curPoint.n;
            shape.style.textX = shape.style.x + symbolSize / 2;
            shape.style.y = this._location.y + this._location.height / 4 - symbolSize;
            shape.style.width = symbolSize * 2;
            shape.style.height = symbolSize * 2;
            shape.style.text = curPoint.name;
            if (newIndex === this.currentIndex) {
                return true;
            }
            this.currentIndex = newIndex;
            if (this.timelineOption.realtime) {
                clearTimeout(this.playTicket);
                var self = this;
                this.playTicket = setTimeout(function () {
                    self._setCurrentOption();
                }, 200);
            }
            return true;
        },
        __ondragend: function () {
            this.isDragend = true;
        },
        ondragend: function (param, status) {
            if (!this.isDragend || !param.target) {
                return;
            }
            !this.timelineOption.realtime && this._setCurrentOption();
            status.dragOut = true;
            status.dragIn = true;
            status.needRefresh = false;
            this.isDragend = false;
            this._syncHandleShape();
            return;
        },
        last: function () {
            this.timelineOption.autoPlay && this.stop();
            this.currentIndex -= 1;
            if (this.currentIndex < 0) {
                this.currentIndex = this.timelineOption.data.length - 1;
            }
            this._onFrame();
            return this.currentIndex;
        },
        next: function () {
            this.timelineOption.autoPlay && this.stop();
            this.currentIndex += 1;
            if (this.currentIndex >= this.timelineOption.data.length) {
                this.currentIndex = 0;
            }
            this._onFrame();
            return this.currentIndex;
        },
        play: function (targetIndex, autoPlay) {
            if (this._ctrPlayShape && this._ctrPlayShape.style.status != 'playing') {
                this._ctrPlayShape.style.status = 'playing';
                this.zr.modShape(this._ctrPlayShape.id);
                this.zr.refreshNextFrame();
            }
            this.timelineOption.autoPlay = autoPlay != null ? autoPlay : true;
            if (!this.timelineOption.autoPlay) {
                clearTimeout(this.playTicket);
            }
            this.currentIndex = targetIndex != null ? targetIndex : this.currentIndex + 1;
            if (this.currentIndex >= this.timelineOption.data.length) {
                this.currentIndex = 0;
            }
            this._onFrame();
            return this.currentIndex;
        },
        stop: function () {
            if (this._ctrPlayShape && this._ctrPlayShape.style.status != 'stop') {
                this._ctrPlayShape.style.status = 'stop';
                this.zr.modShape(this._ctrPlayShape.id);
                this.zr.refreshNextFrame();
            }
            this.timelineOption.autoPlay = false;
            clearTimeout(this.playTicket);
            return this.currentIndex;
        },
        resize: function () {
            if (this.timelineOption.show) {
                this.clear();
                this._buildShape();
                this._syncHandleShape();
            }
        },
        setTheme: function (needRefresh) {
            this.timelineOption = this.reformOption(zrUtil.clone(this.option.timeline));
            this.timelineOption.label.textStyle = this.getTextStyle(this.timelineOption.label.textStyle);
            this.timelineOption.checkpointStyle.label.textStyle = this.getTextStyle(this.timelineOption.checkpointStyle.label.textStyle);
            if (!this.myChart.canvasSupported) {
                this.timelineOption.realtime = false;
            }
            if (this.timelineOption.show && needRefresh) {
                this.clear();
                this._buildShape();
                this._syncHandleShape();
            }
        },
        onbeforDispose: function () {
            clearTimeout(this.playTicket);
        }
    };
    function timelineControl(ctx, style) {
        var lineWidth = 2;
        var x = style.x + lineWidth;
        var y = style.y + lineWidth + 2;
        var width = style.width - lineWidth;
        var height = style.height - lineWidth;
        var symbol = style.symbol;
        if (symbol === 'last') {
            ctx.moveTo(x + width - 2, y + height / 3);
            ctx.lineTo(x + width - 2, y);
            ctx.lineTo(x + 2, y + height / 2);
            ctx.lineTo(x + width - 2, y + height);
            ctx.lineTo(x + width - 2, y + height / 3 * 2);
            ctx.moveTo(x, y);
            ctx.lineTo(x, y);
        } else if (symbol === 'next') {
            ctx.moveTo(x + 2, y + height / 3);
            ctx.lineTo(x + 2, y);
            ctx.lineTo(x + width - 2, y + height / 2);
            ctx.lineTo(x + 2, y + height);
            ctx.lineTo(x + 2, y + height / 3 * 2);
            ctx.moveTo(x, y);
            ctx.lineTo(x, y);
        } else if (symbol === 'play') {
            if (style.status === 'stop') {
                ctx.moveTo(x + 2, y);
                ctx.lineTo(x + width - 2, y + height / 2);
                ctx.lineTo(x + 2, y + height);
                ctx.lineTo(x + 2, y);
            } else {
                var delta = style.brushType === 'both' ? 2 : 3;
                ctx.rect(x + 2, y, delta, height);
                ctx.rect(x + width - delta - 2, y, delta, height);
            }
        } else if (symbol.match('image')) {
            var imageLocation = '';
            imageLocation = symbol.replace(new RegExp('^image:\\/\\/'), '');
            symbol = IconShape.prototype.iconLibrary.image;
            symbol(ctx, {
                x: x,
                y: y,
                width: width,
                height: height,
                image: imageLocation
            });
        }
    }
    IconShape.prototype.iconLibrary['timelineControl'] = timelineControl;
    zrUtil.inherits(Timeline, Base);
    require('../component').define('timeline', Timeline);
    return Timeline;
});define('zrender/shape/Image', [
    'require',
    './Base',
    '../tool/util'
], function (require) {
    var Base = require('./Base');
    var ZImage = function (options) {
        Base.call(this, options);
    };
    ZImage.prototype = {
        type: 'image',
        brush: function (ctx, isHighlight, refreshNextFrame) {
            var style = this.style || {};
            if (isHighlight) {
                style = this.getHighlightStyle(style, this.highlightStyle || {});
            }
            var image = style.image;
            var self = this;
            if (!this._imageCache) {
                this._imageCache = {};
            }
            if (typeof image === 'string') {
                var src = image;
                if (this._imageCache[src]) {
                    image = this._imageCache[src];
                } else {
                    image = new Image();
                    image.onload = function () {
                        image.onload = null;
                        self.modSelf();
                        refreshNextFrame();
                    };
                    image.src = src;
                    this._imageCache[src] = image;
                }
            }
            if (image) {
                if (image.nodeName.toUpperCase() == 'IMG') {
                    if (window.ActiveXObject) {
                        if (image.readyState != 'complete') {
                            return;
                        }
                    } else {
                        if (!image.complete) {
                            return;
                        }
                    }
                }
                var width = style.width || image.width;
                var height = style.height || image.height;
                var x = style.x;
                var y = style.y;
                if (!image.width || !image.height) {
                    return;
                }
                ctx.save();
                this.doClip(ctx);
                this.setContext(ctx, style);
                this.setTransform(ctx);
                if (style.sWidth && style.sHeight) {
                    var sx = style.sx || 0;
                    var sy = style.sy || 0;
                    ctx.drawImage(image, sx, sy, style.sWidth, style.sHeight, x, y, width, height);
                } else if (style.sx && style.sy) {
                    var sx = style.sx;
                    var sy = style.sy;
                    var sWidth = width - sx;
                    var sHeight = height - sy;
                    ctx.drawImage(image, sx, sy, sWidth, sHeight, x, y, width, height);
                } else {
                    ctx.drawImage(image, x, y, width, height);
                }
                if (!style.width) {
                    style.width = width;
                }
                if (!style.height) {
                    style.height = height;
                }
                if (!this.style.width) {
                    this.style.width = width;
                }
                if (!this.style.height) {
                    this.style.height = height;
                }
                this.drawText(ctx, style, this.style);
                ctx.restore();
            }
        },
        getRect: function (style) {
            return {
                x: style.x,
                y: style.y,
                width: style.width,
                height: style.height
            };
        },
        clearCache: function () {
            this._imageCache = {};
        }
    };
    require('../tool/util').inherits(ZImage, Base);
    return ZImage;
});define('zrender/loadingEffect/Bar', [
    'require',
    './Base',
    '../tool/util',
    '../tool/color',
    '../shape/Rectangle'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrColor = require('../tool/color');
    var RectangleShape = require('../shape/Rectangle');
    function Bar(options) {
        Base.call(this, options);
    }
    util.inherits(Bar, Base);
    Bar.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: { color: '#888' },
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            effectOption: {
                x: 0,
                y: this.canvasHeight / 2 - 30,
                width: this.canvasWidth,
                height: 5,
                brushType: 'fill',
                timeInterval: 100
            }
        });
        var textShape = this.createTextShape(options.textStyle);
        var background = this.createBackgroundShape(options.backgroundColor);
        var effectOption = options.effectOption;
        var barShape = new RectangleShape({ highlightStyle: util.clone(effectOption) });
        barShape.highlightStyle.color = effectOption.color || zrColor.getLinearGradient(effectOption.x, effectOption.y, effectOption.x + effectOption.width, effectOption.y + effectOption.height, [
            [
                0,
                '#ff6400'
            ],
            [
                0.5,
                '#ffe100'
            ],
            [
                1,
                '#b1ff00'
            ]
        ]);
        if (options.progress != null) {
            addShapeHandle(background);
            barShape.highlightStyle.width = this.adjust(options.progress, [
                0,
                1
            ]) * options.effectOption.width;
            addShapeHandle(barShape);
            addShapeHandle(textShape);
            refreshHandle();
            return;
        } else {
            barShape.highlightStyle.width = 0;
            return setInterval(function () {
                addShapeHandle(background);
                if (barShape.highlightStyle.width < effectOption.width) {
                    barShape.highlightStyle.width += 8;
                } else {
                    barShape.highlightStyle.width = 0;
                }
                addShapeHandle(barShape);
                addShapeHandle(textShape);
                refreshHandle();
            }, effectOption.timeInterval);
        }
    };
    return Bar;
});define('zrender/loadingEffect/Bubble', [
    'require',
    './Base',
    '../tool/util',
    '../tool/color',
    '../shape/Circle'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrColor = require('../tool/color');
    var CircleShape = require('../shape/Circle');
    function Bubble(options) {
        Base.call(this, options);
    }
    util.inherits(Bubble, Base);
    Bubble.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: { color: '#888' },
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            effect: {
                n: 50,
                lineWidth: 2,
                brushType: 'stroke',
                color: 'random',
                timeInterval: 100
            }
        });
        var textShape = this.createTextShape(options.textStyle);
        var background = this.createBackgroundShape(options.backgroundColor);
        var effectOption = options.effect;
        var n = effectOption.n;
        var brushType = effectOption.brushType;
        var lineWidth = effectOption.lineWidth;
        var shapeList = [];
        var canvasWidth = this.canvasWidth;
        var canvasHeight = this.canvasHeight;
        for (var i = 0; i < n; i++) {
            var color = effectOption.color == 'random' ? zrColor.alpha(zrColor.random(), 0.3) : effectOption.color;
            shapeList[i] = new CircleShape({
                highlightStyle: {
                    x: Math.ceil(Math.random() * canvasWidth),
                    y: Math.ceil(Math.random() * canvasHeight),
                    r: Math.ceil(Math.random() * 40),
                    brushType: brushType,
                    color: color,
                    strokeColor: color,
                    lineWidth: lineWidth
                },
                animationY: Math.ceil(Math.random() * 20)
            });
        }
        return setInterval(function () {
            addShapeHandle(background);
            for (var i = 0; i < n; i++) {
                var style = shapeList[i].highlightStyle;
                if (style.y - shapeList[i].animationY + style.r <= 0) {
                    shapeList[i].highlightStyle.y = canvasHeight + style.r;
                    shapeList[i].highlightStyle.x = Math.ceil(Math.random() * canvasWidth);
                }
                shapeList[i].highlightStyle.y -= shapeList[i].animationY;
                addShapeHandle(shapeList[i]);
            }
            addShapeHandle(textShape);
            refreshHandle();
        }, effectOption.timeInterval);
    };
    return Bubble;
});define('zrender/loadingEffect/DynamicLine', [
    'require',
    './Base',
    '../tool/util',
    '../tool/color',
    '../shape/Line'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrColor = require('../tool/color');
    var LineShape = require('../shape/Line');
    function DynamicLine(options) {
        Base.call(this, options);
    }
    util.inherits(DynamicLine, Base);
    DynamicLine.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: { color: '#fff' },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            effectOption: {
                n: 30,
                lineWidth: 1,
                color: 'random',
                timeInterval: 100
            }
        });
        var textShape = this.createTextShape(options.textStyle);
        var background = this.createBackgroundShape(options.backgroundColor);
        var effectOption = options.effectOption;
        var n = effectOption.n;
        var lineWidth = effectOption.lineWidth;
        var shapeList = [];
        var canvasWidth = this.canvasWidth;
        var canvasHeight = this.canvasHeight;
        for (var i = 0; i < n; i++) {
            var xStart = -Math.ceil(Math.random() * 1000);
            var len = Math.ceil(Math.random() * 400);
            var pos = Math.ceil(Math.random() * canvasHeight);
            var color = effectOption.color == 'random' ? zrColor.random() : effectOption.color;
            shapeList[i] = new LineShape({
                highlightStyle: {
                    xStart: xStart,
                    yStart: pos,
                    xEnd: xStart + len,
                    yEnd: pos,
                    strokeColor: color,
                    lineWidth: lineWidth
                },
                animationX: Math.ceil(Math.random() * 100),
                len: len
            });
        }
        return setInterval(function () {
            addShapeHandle(background);
            for (var i = 0; i < n; i++) {
                var style = shapeList[i].highlightStyle;
                if (style.xStart >= canvasWidth) {
                    shapeList[i].len = Math.ceil(Math.random() * 400);
                    style.xStart = -400;
                    style.xEnd = -400 + shapeList[i].len;
                    style.yStart = Math.ceil(Math.random() * canvasHeight);
                    style.yEnd = style.yStart;
                }
                style.xStart += shapeList[i].animationX;
                style.xEnd += shapeList[i].animationX;
                addShapeHandle(shapeList[i]);
            }
            addShapeHandle(textShape);
            refreshHandle();
        }, effectOption.timeInterval);
    };
    return DynamicLine;
});define('zrender/loadingEffect/Ring', [
    'require',
    './Base',
    '../tool/util',
    '../tool/color',
    '../shape/Ring',
    '../shape/Sector'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrColor = require('../tool/color');
    var RingShape = require('../shape/Ring');
    var SectorShape = require('../shape/Sector');
    function Ring(options) {
        Base.call(this, options);
    }
    util.inherits(Ring, Base);
    Ring.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: { color: '#07a' },
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            effect: {
                x: this.canvasWidth / 2,
                y: this.canvasHeight / 2,
                r0: 60,
                r: 100,
                color: '#bbdcff',
                brushType: 'fill',
                textPosition: 'inside',
                textFont: 'normal 30px verdana',
                textColor: 'rgba(30, 144, 255, 0.6)',
                timeInterval: 100
            }
        });
        var effectOption = options.effect;
        var textStyle = options.textStyle;
        if (textStyle.x == null) {
            textStyle.x = effectOption.x;
        }
        if (textStyle.y == null) {
            textStyle.y = effectOption.y + (effectOption.r0 + effectOption.r) / 2 - 5;
        }
        var textShape = this.createTextShape(options.textStyle);
        var background = this.createBackgroundShape(options.backgroundColor);
        var x = effectOption.x;
        var y = effectOption.y;
        var r0 = effectOption.r0 + 6;
        var r = effectOption.r - 6;
        var color = effectOption.color;
        var darkColor = zrColor.lift(color, 0.1);
        var shapeRing = new RingShape({ highlightStyle: util.clone(effectOption) });
        var shapeList = [];
        var clolrList = zrColor.getGradientColors([
            '#ff6400',
            '#ffe100',
            '#97ff00'
        ], 25);
        var preAngle = 15;
        var endAngle = 240;
        for (var i = 0; i < 16; i++) {
            shapeList.push(new SectorShape({
                highlightStyle: {
                    x: x,
                    y: y,
                    r0: r0,
                    r: r,
                    startAngle: endAngle - preAngle,
                    endAngle: endAngle,
                    brushType: 'fill',
                    color: darkColor
                },
                _color: zrColor.getLinearGradient(x + r0 * Math.cos(endAngle, true), y - r0 * Math.sin(endAngle, true), x + r0 * Math.cos(endAngle - preAngle, true), y - r0 * Math.sin(endAngle - preAngle, true), [
                    [
                        0,
                        clolrList[i * 2]
                    ],
                    [
                        1,
                        clolrList[i * 2 + 1]
                    ]
                ])
            }));
            endAngle -= preAngle;
        }
        endAngle = 360;
        for (var i = 0; i < 4; i++) {
            shapeList.push(new SectorShape({
                highlightStyle: {
                    x: x,
                    y: y,
                    r0: r0,
                    r: r,
                    startAngle: endAngle - preAngle,
                    endAngle: endAngle,
                    brushType: 'fill',
                    color: darkColor
                },
                _color: zrColor.getLinearGradient(x + r0 * Math.cos(endAngle, true), y - r0 * Math.sin(endAngle, true), x + r0 * Math.cos(endAngle - preAngle, true), y - r0 * Math.sin(endAngle - preAngle, true), [
                    [
                        0,
                        clolrList[i * 2 + 32]
                    ],
                    [
                        1,
                        clolrList[i * 2 + 33]
                    ]
                ])
            }));
            endAngle -= preAngle;
        }
        var n = 0;
        if (options.progress != null) {
            addShapeHandle(background);
            n = this.adjust(options.progress, [
                0,
                1
            ]).toFixed(2) * 100 / 5;
            shapeRing.highlightStyle.text = n * 5 + '%';
            addShapeHandle(shapeRing);
            for (var i = 0; i < 20; i++) {
                shapeList[i].highlightStyle.color = i < n ? shapeList[i]._color : darkColor;
                addShapeHandle(shapeList[i]);
            }
            addShapeHandle(textShape);
            refreshHandle();
            return;
        }
        return setInterval(function () {
            addShapeHandle(background);
            n += n >= 20 ? -20 : 1;
            addShapeHandle(shapeRing);
            for (var i = 0; i < 20; i++) {
                shapeList[i].highlightStyle.color = i < n ? shapeList[i]._color : darkColor;
                addShapeHandle(shapeList[i]);
            }
            addShapeHandle(textShape);
            refreshHandle();
        }, effectOption.timeInterval);
    };
    return Ring;
});define('zrender/loadingEffect/Spin', [
    'require',
    './Base',
    '../tool/util',
    '../tool/color',
    '../tool/area',
    '../shape/Sector'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrColor = require('../tool/color');
    var zrArea = require('../tool/area');
    var SectorShape = require('../shape/Sector');
    function Spin(options) {
        Base.call(this, options);
    }
    util.inherits(Spin, Base);
    Spin.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: {
                color: '#fff',
                textAlign: 'start'
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
        });
        var textShape = this.createTextShape(options.textStyle);
        var textGap = 10;
        var textWidth = zrArea.getTextWidth(textShape.highlightStyle.text, textShape.highlightStyle.textFont);
        var textHeight = zrArea.getTextHeight(textShape.highlightStyle.text, textShape.highlightStyle.textFont);
        var effectOption = util.merge(this.options.effect || {}, {
            r0: 9,
            r: 15,
            n: 18,
            color: '#fff',
            timeInterval: 100
        });
        var location = this.getLocation(this.options.textStyle, textWidth + textGap + effectOption.r * 2, Math.max(effectOption.r * 2, textHeight));
        effectOption.x = location.x + effectOption.r;
        effectOption.y = textShape.highlightStyle.y = location.y + location.height / 2;
        textShape.highlightStyle.x = effectOption.x + effectOption.r + textGap;
        var background = this.createBackgroundShape(options.backgroundColor);
        var n = effectOption.n;
        var x = effectOption.x;
        var y = effectOption.y;
        var r0 = effectOption.r0;
        var r = effectOption.r;
        var color = effectOption.color;
        var shapeList = [];
        var preAngle = Math.round(180 / n);
        for (var i = 0; i < n; i++) {
            shapeList[i] = new SectorShape({
                highlightStyle: {
                    x: x,
                    y: y,
                    r0: r0,
                    r: r,
                    startAngle: preAngle * i * 2,
                    endAngle: preAngle * i * 2 + preAngle,
                    color: zrColor.alpha(color, (i + 1) / n),
                    brushType: 'fill'
                }
            });
        }
        var pos = [
            0,
            x,
            y
        ];
        return setInterval(function () {
            addShapeHandle(background);
            pos[0] -= 0.3;
            for (var i = 0; i < n; i++) {
                shapeList[i].rotation = pos;
                addShapeHandle(shapeList[i]);
            }
            addShapeHandle(textShape);
            refreshHandle();
        }, effectOption.timeInterval);
    };
    return Spin;
});define('zrender/loadingEffect/Whirling', [
    'require',
    './Base',
    '../tool/util',
    '../tool/area',
    '../shape/Ring',
    '../shape/Droplet',
    '../shape/Circle'
], function (require) {
    var Base = require('./Base');
    var util = require('../tool/util');
    var zrArea = require('../tool/area');
    var RingShape = require('../shape/Ring');
    var DropletShape = require('../shape/Droplet');
    var CircleShape = require('../shape/Circle');
    function Whirling(options) {
        Base.call(this, options);
    }
    util.inherits(Whirling, Base);
    Whirling.prototype._start = function (addShapeHandle, refreshHandle) {
        var options = util.merge(this.options, {
            textStyle: {
                color: '#888',
                textAlign: 'start'
            },
            backgroundColor: 'rgba(250, 250, 250, 0.8)'
        });
        var textShape = this.createTextShape(options.textStyle);
        var textGap = 10;
        var textWidth = zrArea.getTextWidth(textShape.highlightStyle.text, textShape.highlightStyle.textFont);
        var textHeight = zrArea.getTextHeight(textShape.highlightStyle.text, textShape.highlightStyle.textFont);
        var effectOption = util.merge(this.options.effect || {}, {
            r: 18,
            colorIn: '#fff',
            colorOut: '#555',
            colorWhirl: '#6cf',
            timeInterval: 50
        });
        var location = this.getLocation(this.options.textStyle, textWidth + textGap + effectOption.r * 2, Math.max(effectOption.r * 2, textHeight));
        effectOption.x = location.x + effectOption.r;
        effectOption.y = textShape.highlightStyle.y = location.y + location.height / 2;
        textShape.highlightStyle.x = effectOption.x + effectOption.r + textGap;
        var background = this.createBackgroundShape(options.backgroundColor);
        var droplet = new DropletShape({
            highlightStyle: {
                a: Math.round(effectOption.r / 2),
                b: Math.round(effectOption.r - effectOption.r / 6),
                brushType: 'fill',
                color: effectOption.colorWhirl
            }
        });
        var circleIn = new CircleShape({
            highlightStyle: {
                r: Math.round(effectOption.r / 6),
                brushType: 'fill',
                color: effectOption.colorIn
            }
        });
        var circleOut = new RingShape({
            highlightStyle: {
                r0: Math.round(effectOption.r - effectOption.r / 3),
                r: effectOption.r,
                brushType: 'fill',
                color: effectOption.colorOut
            }
        });
        var pos = [
            0,
            effectOption.x,
            effectOption.y
        ];
        droplet.highlightStyle.x = circleIn.highlightStyle.x = circleOut.highlightStyle.x = pos[1];
        droplet.highlightStyle.y = circleIn.highlightStyle.y = circleOut.highlightStyle.y = pos[2];
        return setInterval(function () {
            addShapeHandle(background);
            addShapeHandle(circleOut);
            pos[0] -= 0.3;
            droplet.rotation = pos;
            addShapeHandle(droplet);
            addShapeHandle(circleIn);
            addShapeHandle(textShape);
            refreshHandle();
        }, effectOption.timeInterval);
    };
    return Whirling;
});define('echarts/theme/macarons', [], function () {
    var theme = {
        color: [
            '#2ec7c9',
            '#b6a2de',
            '#5ab1ef',
            '#ffb980',
            '#d87a80',
            '#8d98b3',
            '#e5cf0d',
            '#97b552',
            '#95706d',
            '#dc69aa',
            '#07a2a4',
            '#9a7fd1',
            '#588dd5',
            '#f5994e',
            '#c05050',
            '#59678c',
            '#c9ab00',
            '#7eb00a',
            '#6f5553',
            '#c14089'
        ],
        title: {
            textStyle: {
                fontWeight: 'normal',
                color: '#008acd'
            }
        },
        dataRange: {
            itemWidth: 15,
            color: [
                '#5ab1ef',
                '#e0ffff'
            ]
        },
        toolbox: {
            color: [
                '#1e90ff',
                '#1e90ff',
                '#1e90ff',
                '#1e90ff'
            ],
            effectiveColor: '#ff4500'
        },
        tooltip: {
            backgroundColor: 'rgba(50,50,50,0.5)',
            axisPointer: {
                type: 'line',
                lineStyle: { color: '#008acd' },
                crossStyle: { color: '#008acd' },
                shadowStyle: { color: 'rgba(200,200,200,0.2)' }
            }
        },
        dataZoom: {
            dataBackgroundColor: '#efefff',
            fillerColor: 'rgba(182,162,222,0.2)',
            handleColor: '#008acd'
        },
        grid: { borderColor: '#eee' },
        categoryAxis: {
            axisLine: { lineStyle: { color: '#008acd' } },
            splitLine: { lineStyle: { color: ['#eee'] } }
        },
        valueAxis: {
            axisLine: { lineStyle: { color: '#008acd' } },
            splitArea: {
                show: true,
                areaStyle: {
                    color: [
                        'rgba(250,250,250,0.1)',
                        'rgba(200,200,200,0.1)'
                    ]
                }
            },
            splitLine: { lineStyle: { color: ['#eee'] } }
        },
        polar: {
            axisLine: { lineStyle: { color: '#ddd' } },
            splitArea: {
                show: true,
                areaStyle: {
                    color: [
                        'rgba(250,250,250,0.2)',
                        'rgba(200,200,200,0.2)'
                    ]
                }
            },
            splitLine: { lineStyle: { color: '#ddd' } }
        },
        timeline: {
            lineStyle: { color: '#008acd' },
            controlStyle: {
                normal: { color: '#008acd' },
                emphasis: { color: '#008acd' }
            },
            symbol: 'emptyCircle',
            symbolSize: 3
        },
        bar: {
            itemStyle: {
                normal: { barBorderRadius: 5 },
                emphasis: { barBorderRadius: 5 }
            }
        },
        line: {
            smooth: true,
            symbol: 'emptyCircle',
            symbolSize: 3
        },
        k: {
            itemStyle: {
                normal: {
                    color: '#d87a80',
                    color0: '#2ec7c9',
                    lineStyle: {
                        color: '#d87a80',
                        color0: '#2ec7c9'
                    }
                }
            }
        },
        scatter: {
            symbol: 'circle',
            symbolSize: 4
        },
        radar: {
            symbol: 'emptyCircle',
            symbolSize: 3
        },
        map: {
            itemStyle: {
                normal: {
                    areaStyle: { color: '#ddd' },
                    label: { textStyle: { color: '#d87a80' } }
                },
                emphasis: { areaStyle: { color: '#fe994e' } }
            }
        },
        force: { itemStyle: { normal: { linkStyle: { color: '#1e90ff' } } } },
        chord: {
            itemStyle: {
                normal: {
                    borderWidth: 1,
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                    chordStyle: { lineStyle: { color: 'rgba(128, 128, 128, 0.5)' } }
                },
                emphasis: {
                    borderWidth: 1,
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                    chordStyle: { lineStyle: { color: 'rgba(128, 128, 128, 0.5)' } }
                }
            }
        },
        gauge: {
            axisLine: {
                lineStyle: {
                    color: [
                        [
                            0.2,
                            '#2ec7c9'
                        ],
                        [
                            0.8,
                            '#5ab1ef'
                        ],
                        [
                            1,
                            '#d87a80'
                        ]
                    ],
                    width: 10
                }
            },
            axisTick: {
                splitNumber: 10,
                length: 15,
                lineStyle: { color: 'auto' }
            },
            splitLine: {
                length: 22,
                lineStyle: { color: 'auto' }
            },
            pointer: { width: 5 }
        },
        textStyle: { fontFamily: '微软雅黑, Arial, Verdana, sans-serif' }
    };
    return theme;
});define('echarts/theme/infographic', [], function () {
    var theme = {
        color: [
            '#C1232B',
            '#B5C334',
            '#FCCE10',
            '#E87C25',
            '#27727B',
            '#FE8463',
            '#9BCA63',
            '#FAD860',
            '#F3A43B',
            '#60C0DD',
            '#D7504B',
            '#C6E579',
            '#F4E001',
            '#F0805A',
            '#26C0C0'
        ],
        title: {
            textStyle: {
                fontWeight: 'normal',
                color: '#27727B'
            }
        },
        dataRange: {
            x: 'right',
            y: 'center',
            itemWidth: 5,
            itemHeight: 25,
            color: [
                '#C1232B',
                '#FCCE10'
            ]
        },
        toolbox: {
            color: [
                '#C1232B',
                '#B5C334',
                '#FCCE10',
                '#E87C25',
                '#27727B',
                '#FE8463',
                '#9BCA63',
                '#FAD860',
                '#F3A43B',
                '#60C0DD'
            ],
            effectiveColor: '#ff4500'
        },
        tooltip: {
            backgroundColor: 'rgba(50,50,50,0.5)',
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: '#27727B',
                    type: 'dashed'
                },
                crossStyle: { color: '#27727B' },
                shadowStyle: { color: 'rgba(200,200,200,0.3)' }
            }
        },
        dataZoom: {
            dataBackgroundColor: 'rgba(181,195,52,0.3)',
            fillerColor: 'rgba(181,195,52,0.2)',
            handleColor: '#27727B'
        },
        grid: { borderWidth: 0 },
        categoryAxis: {
            axisLine: { lineStyle: { color: '#27727B' } },
            splitLine: { show: false }
        },
        valueAxis: {
            axisLine: { show: false },
            splitArea: { show: false },
            splitLine: {
                lineStyle: {
                    color: ['#ccc'],
                    type: 'dashed'
                }
            }
        },
        polar: {
            axisLine: { lineStyle: { color: '#ddd' } },
            splitArea: {
                show: true,
                areaStyle: {
                    color: [
                        'rgba(250,250,250,0.2)',
                        'rgba(200,200,200,0.2)'
                    ]
                }
            },
            splitLine: { lineStyle: { color: '#ddd' } }
        },
        timeline: {
            lineStyle: { color: '#27727B' },
            controlStyle: {
                normal: { color: '#27727B' },
                emphasis: { color: '#27727B' }
            },
            symbol: 'emptyCircle',
            symbolSize: 3
        },
        line: {
            itemStyle: {
                normal: {
                    borderWidth: 2,
                    borderColor: '#fff',
                    lineStyle: { width: 3 }
                },
                emphasis: { borderWidth: 0 }
            },
            symbol: 'circle',
            symbolSize: 3.5
        },
        k: {
            itemStyle: {
                normal: {
                    color: '#C1232B',
                    color0: '#B5C334',
                    lineStyle: {
                        width: 1,
                        color: '#C1232B',
                        color0: '#B5C334'
                    }
                }
            }
        },
        scatter: {
            itemStyle: {
                normal: {
                    borderWidth: 1,
                    borderColor: 'rgba(200,200,200,0.5)'
                },
                emphasis: { borderWidth: 0 }
            },
            symbol: 'star4',
            symbolSize: 4
        },
        radar: {
            symbol: 'emptyCircle',
            symbolSize: 3
        },
        map: {
            itemStyle: {
                normal: {
                    areaStyle: { color: '#ddd' },
                    label: { textStyle: { color: '#C1232B' } }
                },
                emphasis: {
                    areaStyle: { color: '#fe994e' },
                    label: { textStyle: { color: 'rgb(100,0,0)' } }
                }
            }
        },
        force: { itemStyle: { normal: { linkStyle: { color: '#27727B' } } } },
        chord: {
            itemStyle: {
                normal: {
                    borderWidth: 1,
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                    chordStyle: { lineStyle: { color: 'rgba(128, 128, 128, 0.5)' } }
                },
                emphasis: {
                    borderWidth: 1,
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                    chordStyle: { lineStyle: { color: 'rgba(128, 128, 128, 0.5)' } }
                }
            }
        },
        gauge: {
            center: [
                '50%',
                '80%'
            ],
            radius: '100%',
            startAngle: 180,
            endAngle: 0,
            axisLine: {
                show: true,
                    'encodeOffsets': [[
                            17368,
                            49764
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DEU',
                'properties': { 'name': 'Germany' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@d͗ࡔțS̗ࡢǂҾɰॊͧІˋȞёɹɣ̨̙Ⱥ҅ß́Έ՛ϑĕɛĬɁǅ׽Ǎ̷ȽؑǽƨʟĘΟіȫӄί̑ϯ̟ŃŢշýƛʿǤЕ~׷ƭݍţɛыɺʩ±࣑ʲǥǻ܍Nń״ьֺ௅ƸЇɘ´ςǗȐĨ֨ƗࢢԎ@Ɉ͂Ⱦޔƿ˴ǐǲ۰°Ƽȃ֮вȓ̀ӈٌōՠŸ'],
                    'encodeOffsets': [[
                            10161,
                            56303
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DJI',
                'properties': { 'name': 'Djibouti' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȤʹΑӏȩήɯ̱҇ȅƬȭÏҷb_ʮßɶ˴Ѐ̐ϊήñʪȴ'],
                    'encodeOffsets': [[
                            44116,
                            13005
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DNK',
                'properties': { 'name': 'Denmark' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ԋڹ࢟ӄŝΒ௼˨ˎу'],
                        ['@@ȵ̓ʡĞ؁؁ɮХ՟ŷًŎͽҲ}࡬Ɣɪʌʦ݌À̐ɴڮʂѝʟ˙ĶɽҘŵ']
                    ],
                    'encodeOffsets': [
                        [[
                                12995,
                                56945
                            ]],
                        [[
                                11175,
                                57814
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'DOM',
                'properties': { 'name': 'Dominican Republic' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ŀƞپIӾɏɜtƴ̕ҠhʡϐЮ̷̯ͿЍǼϫˡ¢ƱƵ͑½ŷȲˣťͳֻɏƆ§ʎjɬɍʦȲƚÞ͒óҜ'],
                    'encodeOffsets': [[
                            -73433,
                            20188
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DZA',
                'properties': { 'name': 'Algeria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ᮩཽᝩ࿷இϑटćU՘ϵƌԹʊȧЀᬻᆴᬻᆴṕᎠfǌ@ÊQ঺ബب࠼Ÿێɦ͎тচͪجӢòϞ̶સƚƸ͜ɛǲ̃ࢲ¹Ԟ́ՠ߰ҠࣦƢՌΎ߶ʰ෎Ƭർæшůߊͨ࣌P΀ȝֺ¾ǟћƄߟȡۙԭҵôمۊԃRȯԮ͹Ϊຝ˖ݏ°ϵƧۇÔϥŃҟòՇͫΗӺؓέ̘ҵϼƸڒϷςՃ'],
                    'encodeOffsets': [[
                            12288,
                            24035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ECU',
                'properties': { 'name': 'Ecuador' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@҂غǻξ͍ϵԉςǞʀƙބ̎ŴƺԼ͆զÍ΄ҢǸ׀Ͱࡀӑƾ`Ȳί܊śʆƆЮ˧άȣŞٓʽճࣷ࢟য়ͧԥܵǃ֣Ӆ΋ΙъͻĞ΍áw̮ʈȨıΔ'],
                    'encodeOffsets': [[
                            -82229,
                            -3486
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'EGY',
                'properties': { 'name': 'Egypt' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɽͷǹىɫѩȝƥ˩˔ϛϒ׵ஸđùΐࢯԪࡋٌವ̴ҙ˒ӃݮछǗƣճ঒ݭƨǣΏ@Ὁ@⁩@@ᶶ@Ჴʥڲɐ԰Żά̤Ж૦b߲ɝ࠲ʛϴſ٨ˊΌʊݎêװŃɮеȜ˜ڨȣټ³аɄւ෽'],
                    'encodeOffsets': [[
                            35761,
                            30210
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ERI',
                'properties': { 'name': 'Eritrea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˻˖ΉӰϋ˒ɏܷ̄ͶֻXȭǬӯȡԛϢʽط঑ǬęʹβఀĊ֒ˆʴؤƐьӒӦঃɴޗҢУବߏҲӍҖӝˀ˿аʧʩȳέò'],
                    'encodeOffsets': [[
                            43368,
                            12844
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ESP',
                'properties': { 'name': 'Spain' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@¦״΃θஒ؆ਊƱ૾NࣂƝۦªമͰ͛໺ϡ̨ǺीϝআŊ®ӥߓ֓ઁǯõ˱ԩү͕ہ͞ӑӟϑǹճىǗש٥੧_ߟhՃ͍̓ͅЩê̵˴ʃӚ޷žé˦̶̀Śɬ̃ʢɶրͳԌδèЈƎŬZپϲɪɻфөƝŁӹCɁЬ΃ū̥ɇ'],
                    'encodeOffsets': [[
                            -9251,
                            42886
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'EST',
                'properties': { 'name': 'Estonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĮӸ̱ŁՓ̘ñӘਫ਼ɼ੔Ũ࣮Ƒࢂ|Ŵƣׯӝʞ޵ΫˉۙDܡ̸ρļ܏Ʃ'],
                    'encodeOffsets': [[
                            24897,
                            59181
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ETH',
                'properties': { 'name': 'Ethiopia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԜϡӰȢȮǫּWܸ͵ɐ̃όˑΊӯ˼˕̏ω˳Ͽàɵ`ʭҸaȮÐȆƫǽ̴̕ҧ̴Й̛͎ᩨঽۺNᛛᡃફݟףաeɯ˅ַB͹˴ލΙʝΓ֕àȃĬȟwˇT੟܌ב@˹ˢ@ҾѧƘӻࣴϥȚƧʹэЦԧÒ˸ӐҀrŲʰ[ݲʞࢠЊɾĎ΄ήٜԔи΀ࠠƆܠ঒ǫʾظ'],
                    'encodeOffsets': [[
                            38816,
                            15319
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FIN',
                'properties': { 'name': 'Finland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ūיಀ֓ޡى঎ख़֡ܛݴس΅յఘֻ́ѓޭӟᅡੵໃá๑̯ൃǯӡҞ߿ˠȈࠢСݶАӪނՆ኎࣮֖Ǭē΢ୟЈ˳͜uಒ಻ֲ૩ЪԊɞतѻલ¦ࣘȭߠϊЬ؞ಬ˶઄ͯΡכ'],
                    'encodeOffsets': [[
                            29279,
                            70723
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FJI',
                'properties': { 'name': 'Fiji' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@̂ʍƓѭԳŗҩļąτ͖̀ϤĻȼƐ'],
                        ['@@՛ǯŅ̼оǤˊ°Ӱˀ@ЧՕȷ'],
                        ['@@é­@ШǨĽЗ']
                    ],
                    'encodeOffsets': [
                        [[
                                182655,
                                -17756
                            ]],
                        [[
                                183669,
                                -17204
                            ]],
                        [[
                                -184235,
                                -16897
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'FLK',
                'properties': { 'name': 'Falkland Islands' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@৘Ԍ܎ȿԌʹڦϙʥ̋ଋʥϙ̌܋ϙпϚ'],
                    'encodeOffsets': [[
                            -62668,
                            -53094
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FRA',
                'properties': { 'name': 'France' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ˣ٭ϡǠș֢ǜ̺ը͎Ɯܛ'],
                        ['@@הЅќà݀ϥȊñʎjЈɗெƷыֹŃ׳ɱƝϣüɇؙҽ]ϟВƀ˾ρʁʚ̿̅ʯɐٱҖŃĩηݿӅစɬ௧˗ĩԑঅŉिϞ̧ǹ໹Ϣͯ͜ѢԎǆူࢁࢤإю౹͒čؖઠǾථɏˇॎߌέዠپʨێܾǞŪ̑ϸ_ϸ͵']
                    ],
                    'encodeOffsets': [
                        [[
                                9790,
                                43165
                            ]],
                        [[
                                3675,
                                51589
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GAB',
                'properties': { 'name': 'Gabon' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࡹࡔ։ۚԙࢄ˨ǾˎȲؔǜخ˴¶௢SOৠЌÆԞőӼňľ¯ÓνɼѡشèȾǗεঃЊӹĞٿŁ֑ʳЇݏ҅Иãϋ֥Ĺ˽Ɂ̈́֋ٕҩ'],
                    'encodeOffsets': [[
                            11361,
                            -4074
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GBR',
                'properties': { 'name': 'United Kingdom' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@҉ֽًǦԱ[ǦҊǥ҈۴ࣔԳ'],
                        ['@@࣋ࣧࡦŘऄIɕۅݯݩࢄÃäĕݠ঱ֺƇԬढ़ʈͧৰǅķ՝ѓʗͲѣݱѯ૳Rෝɱϻǒ։ϿޥĪם͍ҁǘ௼ࢨݪǺOBಽƔʃͰ࢜ʺҡҐǆռఢ÷D@ŮӤ֛Ԯ_\\৵ƨȧɬ̨ϒˡɴҍЇ·߶щє̨ࢆٶھڤá০ì']
                    ],
                    'encodeOffsets': [
                        [[
                                -5797,
                                55864
                            ]],
                        [[
                                -3077,
                                60043
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GEO',
                'properties': { 'name': 'Georgia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ųάȿִӟ̲ҭĬ̯ʴĺĲ܄ƝఆƋଦЕƦƻԚƂ޶ǭʴ·Նșɓřвғŗıҏºصʎȵƍଢ଼ſ߳Юࣅ¡'],
                    'encodeOffsets': [[
                            42552,
                            42533
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GHA',
                'properties': { 'name': 'Ghana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@೉ӯҳ˽ݳʑݡʆͨηܤɖैΠ۸ɟ஢ŗنrӊฤ¢ϊÕ˔ƊϴáÕʿΖџC؍Ąڍɂ̫ȅݳäйɢՓȈ̍'],
                    'encodeOffsets': [[
                            1086,
                            6072
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GIN',
                'properties': { 'name': 'Guinea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʃtǡͷʁJǏǴÈͶΗԨɕħǵmɳ³V̮ƇɘʔǻΜɹ̜ڥDțǁɵoƝǷīɹ҅σρӼ͛͢ɋŊȿǖħϊūȂʓƐώЦʮeɖƘȄDƄŎï˨ĢĖd˶МU؀ȱȄlÚĤҜáŨ´¶̭ƆBɖŒƔɸɇάãɲǺ˖ŒȬŠǚuȈȁĴɳΆΙǣɏ˙ǴĊŀį«ʡʲʍǗÝå˷Ș΍Ⱥڧ̷ĵăśÞǋ·νƃA'],
                    'encodeOffsets': [[
                            -8641,
                            7871
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GMB',
                'properties': { 'name': 'Gambia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ņόࣶzȎȦˊ`ͨȷʼIˢƚǞʏεȋιdέǰ̷ȗƭQȫŝއl'],
                    'encodeOffsets': [[
                            -17245,
                            13468
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GNB',
                'properties': { 'name': 'Guinea Bissau' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@҅ΘΝÈȕʀLŸʯǴÁǶѼƌ˦ɦĨ༈c˵ġĕð˧ƃōȃCɕƗʭfύХ'],
                    'encodeOffsets': [[
                            -15493,
                            11306
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GNQ',
                'properties': { 'name': 'Equatorial Guinea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƿŴ़̀െmPয়௡T˳µ'],
                    'encodeOffsets': [[
                            9721,
                            1035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GRC',
                'properties': { 'name': 'Greece' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Ҡ˱ٺ¶شÑqƣҜĶĿʛ௃íTƒਁǎƺΦ'],
                        ['@@ʹՁȥĥԟ|ѫĀৱɓ׌ҿяƋҳAѻўƿȁȊԅрЁ̓ǿҴϯжʑ^ӅޥɠʜѕՓĕ͈ݏ֏Yۍμ̿ڦƧ֒͝ϮљӐÉʆϸТ¼˚˘Ũjɚռö͌ȀҖgƒƦǆت{ڨɲע̉ކĀVмЦɝ']
                    ],
                    'encodeOffsets': [
                        [[
                                24269,
                                36562
                            ]],
                        [[
                                27243,
                                42560
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GRL',
                'properties': { 'name': 'Greenland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ᬜԆ᱒ੴ̴ᲈĄ䀦Ŀ㉊ڗ༅͕ộ⭏ćшƫᲐĠᡚ́࿈ʴۦ̝इӧᒞ̺✘͚ᠼǋҾΫ⃝ױӃȕ᧑ơወ¡ছؕگկध৚շಽ൧ˇ༂ѽȢ܋࣍ýઞܡህÑঈ΁˟̑இŽ୥E੆֩\\Ϗပΐћɣଌȿ઼ԣ͈ڱກǉ٫͖ਣӘ˼֭উѵᕖ୆¯ᖯܵᗿڏឧ́ओIࢅ͓ୟࢱᅵכׅ૧ȷ஽ȝܛԱ[כыտോڧͺٿϗ۝љࠍஅ½఍ۈဿLࠁҢ֕ࠐฝਲэոŗݮ୓ޢ̢ئ֗̒ࠪচొ̺ͨΘǬڀॡ̕қůݯţਏ˜Éְ͢҂ެ\\႔ɟ෿Քݩ˾࠷ş۫ȼम޴ԝ̺ڗ׈ৡࢼ੯͚XΚᖷӮᄻÖᖟᏅ×ইˌวՈᕂ˄ၚ¬≹ɖ቉΄Ś͜ẊИᶎИ̪͘ᗗ̠ܺͰ᯲ז௢ĚΓϘጲɜᣚƂᣖRࣺʽᕺҨፘ̽୺áპ˙ፅҐŘή'],
                    'encodeOffsets': [[
                            -47886,
                            84612
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GTM',
                'properties': { 'name': 'Guatemala' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ћƦԻfϩǖҍΌrʖĮȠšƾКۆ઄Ft˸Ƌ¾ġǺ̵Ț̹ˬϜDBӂ޸BަUOڗßॅʤ@˚ƱòŰʘŃϥ͍ЉɻÏǉâǑǧɇȟ½¬ıƿġ˽Ƀ}ŭ'],
                    'encodeOffsets': [[
                            -92257,
                            14065
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GUF',
                'properties': { 'name': 'French Guiana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@͉͑ГÑŗʀȉʹɩνǦɈΪòϤƢή͛ӸáֺѪܠ˸ğؤȥࢸۿƔ·ӻޑʳأ'],
                    'encodeOffsets': [[
                            -53817,
                            2565
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GUY',
                'properties': { 'name': 'Guyana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ր̯Դյzџ̈́o҈Чͪ̇Ƈݱԛɕ°ȣƹџϊ؏ːAŎӃԢܳȱҫî˙ɡϟƥ˅ġǑЭ¦ԫЀÓϴɋьƆܐɸ̐ȕϸ˿ŶŊτțȘѩْ֩ɬɲiϲԬƊȾƾ˽̸ô̬ږӲ'],
                    'encodeOffsets': [[
                            -61192,
                            8568
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HND',
                'properties': { 'name': 'Honduras' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ơˀʭòÐʹŗĞǣÒσĳŔʩƈǷǚʛìǨɈáǒÐǊЊɼϦ͎ĔȂƨʊ\\þåž¦ϸùϲv˒ĢİĦˎ©ȪÉɘnǖòϨśƄkʲƿʐį̏Źɜɳ˽jśŕ̇ŋɃAȅŃǙƛźĕ{ŇȩăRaǥ̉ɳƹıđĽʛǞǹɣǫPȟqlЭūQĿȓʽ'],
                    'encodeOffsets': [[
                            -89412,
                            13297
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HRV',
                'properties': { 'name': 'Croatia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ȳ͗ˊʇ͓̓ϝȆׇ[ܟƔϽmǻǧ̝ȖǫΑЪϽǼʹϮ̽͌ȃ͆Ηݔ͇ġƛ߃̶ӣ̢ޑʠ۹ؤǞØϥΞe˲եƄʱγʝˮn̆bגƸƚ˸ƍͤgGɼ̈ĒĈͺڞɠˊĻؼέۜǉ̼Ų'],
                    'encodeOffsets': [[
                            19282,
                            47011
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HTI',
                'properties': { 'name': 'Haiti' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԢܰƁôқÝ͑ȱƙɎʥiɫ֏ƜЅÍԡÔϽƿ҉ʾö˔ޜśيã̢ȈϧθP͎ՋžȌɶ'],
                    'encodeOffsets': [[
                            -74946,
                            20394
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HUN',
                'properties': { 'name': 'Hungary' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˨ըǍǼӂDÜ΄ђɋ̲ğ۸ļäǚͮ~ЦžĜÃЂŀȠȢˠ¼࣒ʭǴĒҲɭÎɣԡǭЉ֫ԕ֭کǁԽ١ə̻űۛǊػήˉļǍ˴ƗV'],
                    'encodeOffsets': [[
                            16592,
                            47977
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IDN',
                'properties': { 'name': 'Indonesia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Λe૝ך޴ǒѴʭ̎ʭ»ɩ'],
                        ['@@ܙȁĳĶø˸ΰԢࠨͬĐǓfʫշع'],
                        ['@@̢ɣԲèȼΥॿǛ׉őҍP̀ӚҤPɤ̖'],
                        ['@@ūұ౅ʅૣľE̬ښǪՂʥ֔Üݬ̮'],
                        ['@@ྔċȂΌ༘З̪կీƵਐӿय़͋ऍ͸ݻwࢍØ޻ưঅ͎؝ČΓŁ໕ΌƣΰޑØּߤ৶·ڴ͡ΒÛŘ̗'],
                        ['@@ѝֱćنƬ̠Ǭ˴ȒʗCЏ'],
                        ['@@̿˥ׅƸǏΰࡘ¢Ⱦˣ'],
                        ['@@̨ٝۿΌۯìӃÅׇȦҦਠऎʕ'],
                        ['@@ɼയ࢈ԉ۰ࢼ८ԔݜBܘ̉خ̛ࣘǇbᩑbᩑݟې࡟ǜȷʇ੡}ΦۂՈɺɕࣲЕ۸࿃܆ۗêృަʛУ͑óȏ̮GκٛЮ̢ࣞ״gëɠ௵DͩԄݥƺΡдଈȰњ˜ഘ·Ƃ̹'],
                        ['@@ڭ࠭كǉ߱ǐඓ¥ܽŧţٍݪݛҒϠ༪˸çϯλŪιӯ͙݉ߒ੿Ƶ˿ݲॻQտ҅ʙ̐͡Мی࠙͗ȻɶŊ͖؅ӲØࠌ֕ʭîওறՓũίʚʌޜŽ߸ΛPʻֺΎվŤښф౎ǮΎ܎ذپʛ੖śॴࠨ؎Ʀȉ'],
                        ['@@©ܽџĈŷԝΌѷɽĵ͹Ւʟ੺ǚڤ˨̨ÔҝӸóĀ΃'],
                        ['@@सާহį˫ֵݿַ߱u࠷͕౻ŭ̚ॕϙͫԤ׳´лːৃ̟̩Оս¯ۗĬŹૺнɺЕܘŝ݀ĮުԂ֐Ɩָ֗ӅըǠ՜ÑӪъЖôߒɽۆǶњୠ͔̈̆क़ॲ@ܰƙӍݷآߓơϭ'],
                        ['@@छkۻ۰અۊέԚٍۄзؾٕ୴۪݅ʙܠ̳ڀݵՊѭܘمҺࢗऒóђզಢǋݔࠓٮ֫ҪΓߔࣙࡢ_ۺֹӠ۳٘ϥͳۉӖ̞̅sƜו̊ҵؠõФՏɁ਱ಟ']
                    ],
                    'encodeOffsets': [
                        [[
                                123613,
                                -10485
                            ]],
                        [[
                                127423,
                                -10383
                            ]],
                        [[
                                120730,
                                -8289
                            ]],
                        [[
                                125854,
                                -8288
                            ]],
                        [[
                                111231,
                                -6940
                            ]],
                        [[
                                137959,
                                -6363
                            ]],
                        [[
                                130304,
                                -3542
                            ]],
                        [[
                                133603,
                                -3168
                            ]],
                        [[
                                137363,
                                -1179
                            ]],
                        [[
                                128247,
                                1454
                            ]],
                        [[
                                131777,
                                1160
                            ]],
                        [[
                                120705,
                                1872
                            ]],
                        [[
                                108358,
                                -5992
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'IND',
                'properties': { 'name': 'India' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࣚটďۅͮїѕ׽ŒɾएࠜՑ୞חՑϟ͛޻ࠀͅߊЭરһସŉӜёٮāৠȝ۪bĪͪŋՖÞβԠǮìڋlǙކ͉Ոƀ܀Çۈ|ÐԪ΁ˎڴŀވشॸ՘۶ȷ״ΞЀԹ˳Λ࣠űÜ͇̍Ʒèԫ׷Ʋછׅ~ӓҩ۵§ХϏۗځȒࢇȏ˹ĚΣгȥѵ೰ɵEƍ՝ҡѦʸӎϖ¶ϰ܆ӝƜީ]ߝŚóאБ¤ڕζ֭̓؆ѻԿ̻ȅ̩Ԭɣƛԑ̆كžەţֱ̫Zਛǩ´ك҃ӻ௃֡ळ঩كՋ࠷ջCϭлȹݳ̝Ͻ«ʥٙǪધ®ۡΣߙI෗ѣ¡ϣٙʰˣދʃ˱֯͵ʍߑ޸ϳ୴͑ࡒ̍Јѿ߰ȻੂơՀޅ଼Α࿀ʣ੾HৰǍ޾௣ԉףĶ઱৲И̤ʝͤড܊֖֔ᇜCǗܞҽюĩ٨ջϘऒࢢঊÙ࢞ࢢՄ࡞ࠄࡈ_״ܒӠڳд֪݂̇̕Ьβ౤ȱपŰߺ۸'],
                    'encodeOffsets': [[
                            79706,
                            36346
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRL',
                'properties': { 'name': 'Ireland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƒ׷ًݣ๯ӹ஑Ŷڼ࢚ѭࡢତڄٌϼǦ҇ǥ҉Բ\\ٌǥ'],
                    'encodeOffsets': [[
                            -6346,
                            55161
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRN',
                'properties': { 'name': 'Iran' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@݈ǌװӔ֚{τƾװýघэڤğ।ݓظòۻ΁਷ɱؑκŭΫҡˠڡàՓِƙæեݿݿжѵ͸ԓߦυx݉ДƋêϯ௉ѡ̓উཌྷʪࣷȖेŊΧਐЕƪ٣ƭࡑНਇ˦ࡑ٦߳ʈ֗ߘا૪ҍƋՕ˦̻͝ҭѴS҂ˍ@Ɛ،ѝٔ਍Ң׉ߜȜپц̂ÙӬտʨխ৊ҟڨǐʼʿ६ּʈƄͅъϯ־ő̤~রئ̀Øʞʙ́гԼѱȾ¦ˈإߖǩ׎у஠ƟಾɞĄȞ'],
                    'encodeOffsets': [[
                            55216,
                            38092
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRQ',
                'properties': { 'name': 'Iraq' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@րʧÚӫх́țٽ׊ߛ਎ҡўٓƏ؋ˎ@TҁҮѳӿ¤֟ê؝߭༟äᛍၖఫךৡɪ͹৾ᇶ࢔͆৬āؘҢȺјԾΰž঎Ň̐ɉЖƚծ৉'],
                    'encodeOffsets': [[
                            46511,
                            36842
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ISL',
                'properties': { 'name': 'Iceland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@șիॊֵથٙᝓֹܣƵૉŮᚑˈࠠψᆧЪ๪ǎʘᄋȜ֨նౠŰಸ֭౨Ҝ੒ʃൌ҄ආÑ'],
                    'encodeOffsets': [[
                            -14856,
                            68051
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ISR',
                'properties': { 'name': 'Israel' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƥ˅̣Ŝǫ֓ɂĥɋřɛЄŖp͛нഉց෾ʔˢË¶ɞϼǠيŤɆzVˬCþƦɤ\\`·ŕŵhM'],
                    'encodeOffsets': [[
                            36578,
                            33495
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ITA',
                'properties': { 'name': 'Italy' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@̟ڋŲʹǭѝٝ̈́ёĞ୩ѐŞќজûࡪĠْò'],
                        ['@@Ԍ׭ş૕ϣÂ΁˫͇ɞ২ȓӒҨ¥рʼ'],
                        ['@@ரɏĝЯȬΧڝŪہ̗²зĻʇˠё߀чцۛदڱچLȲȃɽǗݪ̥ؠʩܜѫĔƿƽ̛үϼܳƐΝի؈̷ıѫΗ¹҅ܛΕÝHʲǢҊǼǶ͝ӤʱшΑŀʛδգƴεͶثÆٿϜޑմ֯ӜʿࠪйĮہˤϯŕӝϵΓÕĪθҕńɏٲ̆ʰʙ̀ʂβǵМ¢Ҽ˶ƢƃАǼͺتĿψƚâΆԘšĮǆࠨƤȊ̉']
                    ],
                    'encodeOffsets': [
                        [[
                                15893,
                                39149
                            ]],
                        [[
                                9432,
                                42200
                            ]],
                        [[
                                12674,
                                47890
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'JAM',
                'properties': { 'name': 'Jamaica' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@֢÷ҀȫƔɯןeʭƗҹƊӑ̪ĶȔΜÎȒ'],
                    'encodeOffsets': [[
                            -79431,
                            18935
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'JOR',
                'properties': { 'name': 'Jordan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ʀˆपͫ࿪ࣆͺ৽ǅų၅у࠸࠿ˣƛƑ˭ٙřȩ̡εʵधƆŨоഊo͜Ůʚ@Ԥ'],
                    'encodeOffsets': [[
                            36399,
                            33172
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'JPN',
                'properties': { 'name': 'Japan' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ņ˽ҿԕΉːљțɝӭշʈRЊҬԆӌīΊΜؠǹ'],
                        ['@@́ڡƤсѩף੹Ѓ๏½ணॡ͔֡غษȃষЃঝe࡞أ֗෗իΝН͜ȶݶՏʒͿ־ߐʶѲՈࡌѢ؞ָာʤ࣎ǣࢠ๺֔Б௾ࡀӌ͜ՈਈƟा΢ՎࣀƸҞୗ}ڻޥࡍbࢁ'],
                        ['@@נǵרΤȈहఝɯ݁࠱೓ָқँण]ř࠴д٨࣌²ʖ୐ʜټন࢓٤˯']
                    ],
                    'encodeOffsets': [
                        [[
                                137870,
                                34969
                            ]],
                        [[
                                144360,
                                38034
                            ]],
                        [[
                                147365,
                                45235
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'KAZ',
                'properties': { 'name': 'Kazakhstan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӕƹ્דο׹̹KɱЊ੫ǡێХNÚࡆ৓ؘ෷ßডũߣݶۋ͆ಥ׼ƽðᓗӹᶽљ£יچ֧ɼॕǩχ˧±ȲȶΖǅ̊অ˺ϛݮҩɆ˜ࠊāؘ܎ƎܼűƲࠎƭԲ࠿£܍ȴঃσ޵ǭяƌĐўՙ֘دw܉֬ӞِʕǢڢऊࡺӣŀؘჄࣴಾtᇢ׉঺ͻࢼΠ೰j੺ѥʔʠ୼ɂЊഷ׀߮Цƿɮ߮ɔ؅ֺϬ˼Ḯ̈ШȺᑆ̴ݰΒຢǹ˄ࢉ࢚Ȳઆ˹éҝ߮´ᑌߎ̭ˁ੶٭ሠᒑ҄ѰୄӛீɎҪƯКӟטǋΨΥ઎ŒѾԣٕ֓ۥÿ¡ࡅұϝဟˢ؅ຑїȇဗͱݲลֻɓäӏԭŬу̠ఝĖඃx̧ġ஥ΞӉǧŽӹ൩̂փşȉρ'],
                    'encodeOffsets': [[
                            72666,
                            43281
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KEN',
                'properties': { 'name': 'Kenya' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӾۙיͱȹΕ̿Õšףˑ͹Ǐ֑ͷ˥஻ࡀËӤᵁႌƙĢSࢺʊ;а֌̨ؔσ॰įтЉ׎ԬԈ֬ֆѨƗ@ҽ˺ˡג@੠܋ˈSȠxȄī֖ßʞΔގΚͺ˳ָAܽ॑Xᵣ'],
                    'encodeOffsets': [[
                            41977,
                            -878
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KGZ',
                'properties': { 'name': 'Kyrgyzstan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȊςքŠ൪́žӺӊǨ஦Ν̨Ģ඄wఞĕф̟Ԯūşȏ೛ғ̙ͭઁıͅ՛ࢷŒׇǏߣЇŜȟʇȓཟŵਡ˘࣫ÝĂӜࣴƕ̮ʸٖĉ੾؂঻ѸױȽإ͂۶ծʟĊ'],
                    'encodeOffsets': [[
                            72666,
                            43281
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KHM',
                'properties': { 'name': 'Cambodia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@΁Ѭыࢄȣ২ՠۨઘǆ߀ťۚ͡Ϟׄݖ̱Ȝ֕Ļ৕ඳ٧τԙࢥÓܫͷ۱Ū'],
                    'encodeOffsets': [[
                            105982,
                            10888
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KOR',
                'properties': { 'name': 'South Korea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ܨযȺխPॷ̓ҥݽǉڥΏݳïĥҚƼـχ࢔ذƚֻܘÂúϒ͞Ϝצ¢ΨÈŨȮ'],
                    'encodeOffsets': [[
                            131431,
                            39539
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CS-KM',
                'properties': { 'name': 'Kosovo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǣŃPĘ́ȩĐǳɦƾȌȪÒŜ˨ư²Ţşƾ¿ŌƅƒǎƻŢLĥȳĳĳ×ȉӹŻ'],
                    'encodeOffsets': [[
                            21261,
                            43062
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KWT',
                'properties': { 'name': 'Kuwait' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ǭχõȓ˔هשuȽАݟĆ؞߮֠é'],
                    'encodeOffsets': [[
                            49126,
                            30696
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LAO',
                'properties': { 'name': 'Laos' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˚Ϝ܆ڹܸ¿ٕࠦھٍÎǛ̉ӯyʣƨࢯԅoݬȸࢮ֧³ԎηʸǴ̲ܐնøȡ҄wŵ०ѦŬӮڏϖޅਚO͚ܹ՝ɗʉ̟৔ԉۦ঳Ռ݋َ׏ɄץƵ࠿ݕ̲ϝ׃ۙ͢'],
                    'encodeOffsets': [[
                            107745,
                            14616
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBN',
                'properties': { 'name': 'Lebanon' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɣ[ýƥ˫D̘ۄмעfϘ§Ɛͣқ̓ȷҟ'],
                    'encodeOffsets': [[
                            36681,
                            34077
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBR',
                'properties': { 'name': 'Liberia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɗQࡽАޅٖ܏Ң֣ըȪː¬ʔϜҘϺϺǶnɖĨΘԧÇ͵ǐǳʂIǢ͸ʄsʓĎНǽύʖɱˊÇΤΙ~ͧăĿÝە'],
                    'encodeOffsets': [[
                            -7897,
                            4470
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBY',
                'properties': { 'name': 'Libya' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ק̷ҿҤ೧βρՄڑϸϻƷ̗ҶήӹؔͬΘñՈńҠÓϦƨۈ¯϶˕ݐШȜðΠėΒ־͔ʶːЦʌ´٦দ́ΜðۮƓ૞ϓЀݛݮǍஆΙࣆйЦɔЖϮț٠˂Ф؄ЀׂŘ଒ǣ˺ϑ̺Iˌƛ࠴ıȲˣ̣ЕżΫɏԯʦڱ@Ჳ@ᶵ@့ॱGYΙ‧ྐ‧ྒࡓҟ'],
                    'encodeOffsets': [[
                            15208,
                            23412
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LKA',
                'properties': { 'name': 'Sri Lanka' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ų࢓ΙʇܵȓЍڜƫீϠ഼׆ұϺסО࢓'],
                    'encodeOffsets': [[
                            83751,
                            7704
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LSO',
                'properties': { 'name': 'Lesotho' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̆ʩʳУƛ˛ҳſƹˍ̛ċؿ٨҄ՐҖ͢ϼǠξʵ'],
                    'encodeOffsets': [[
                            29674,
                            -29650
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LTU',
                'properties': { 'name': 'Lithuania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ãɊĚɲχƄࢡƨǱ۸२ʴඬÁࠜĊŞǩ҂Ã߲СĀϓۏˏșӃ࣯̓߻NȫʶљĜ'],
                    'encodeOffsets': [[
                            23277,
                            55632
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LUX',
                'properties': { 'name': 'Luxembourg' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǘȏ³ρʍiȉòĞҼɖ'],
                    'encodeOffsets': [[
                            6189,
                            51332
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LVA',
                'properties': { 'name': 'Latvia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@نЮՆߊ˼ڜعڪhǊ٤ܐƪςĻܢ̷ۚCКȕîС˒ӷ͕ࣗԛƙ߱ТҁÄŝǪࠛĉණÂ१ʳ'],
                    'encodeOffsets': [[
                            21562,
                            57376
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MAR',
                'properties': { 'name': 'Morocco' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԒΥߜÎࢊȃκU͂՟ºԝ̄ࢱɜǱƷ͛ષƙϝ̵ӡñثঙ͍ͩсۍɥ࠻ŷഫاRহŷ@@@p҉Ա˓ȑϡ@̥Ŋ۹ě˛ٻʿÕЁ੕ୟ࣡ˣୋ΅ϗĵ̡ቅãaD ϶͒ɮ˞ѪÃ˶̀פҴՖ˲ƊɞӬp҂̤Բ̪֔Ւ࡬f\\ц͔ްĢڎָтɠۮۮȿਸ਼͊ܢŔѶդ֨ࡈϦخΐ֘࢈˄ԪؤI'],
                    'encodeOffsets': [[
                            -5318,
                            36614
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MDA',
                'properties': { 'name': 'Moldova' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȨŮ֒ĊؤʽΊϞɥÑ˵̪ƏŨΗ̊ɇÏűƾčɝ×ӷ|ĉŜǫãÒƭɱˍƥ˽ɁĝƯϦĘΪςӝԂˉΠʹʠʯĈ'],
                    'encodeOffsets': [[
                            27259,
                            49379
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MDG',
                'properties': { 'name': 'Madagascar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɠΥȺ։Ɗঢ়ɒϽĉЗƩʙ˷ӰǁʝǈثõΥɵȗ¿܅ͧওб୅ԯཧ͑ୟϛইہȣܻΡӛɊڙ̜ɳѺÇݘ̑ڠù؂Ʈ؄ϰƢD˪Дِø՚șЈǃՌãޠ̊ҺŔՒмҶǤ̶Ʋτ\\ӐӎۖԮʦцŗάΦĵҪ׎fԐ˦ϔ̊ί'],
                    'encodeOffsets': [[
                            50733,
                            -12769
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MEX',
                'properties': { 'name': 'Mexico' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@͙݅ƥ؁Õ૷ąЧƤқʺЧǚٳ֎سȞӏ͢бࢾɝΐΙ݄ɾٚĎؼưՊƠՖ΂ȨӬè۸Ƣʖ֬ɚࢶȚݔԚîȬǱЙҋԁȥԝƸƥűγɁٽɅɎǭcǃY̝ԓƳĲķPŭޥV޷AAӁϛC̺˫̶șĢǹƌ½s˷ઃEЙۅŢƽĭȟqʕ्ࣞџ˘ۇɖҷÓګ́чĉץɜؿǄ޹ϬؿŠ्ϸ۱ВɃɤҹº࡯ˈΓϦࣗӊсՌȧЦ˪ĈđʈȖɔJ̄˱Ϙùͮ˭ъ݋࠴ࡋڀУԼܝ΄ƷȴŸԲѓȞӹФȽהҍæӣѸϿФˀҍو̓٠^͔؇ͬ˫ӑɴƇͿƔЕĆف̀΋خׁƒȡŸÓŎ˽Ƭ\\ǜթʮɇǴ̕Նё˨ޯʠρɸϿ²ѷКͶϡ̨ϑqƭΝ̱ƫJɛԞջӎ؃РїɈؚŵҖЏʺֿϒŏŇɃɖԭȰӷӦÖÚΊ³̸̼Ϝ٩׶ӱɶ̱Հ̷վϳڦͿݲॖÞ੪ĞÿǑ౔СኀףဪPژ@DΌผ@̪̕јˇԀσ˨ѭȾҥѢʩۤʥՊڒۊhפͱфֹ̄ӯӸӏȂחɾЃپʹ׮ȁ͞|'],
                    'encodeOffsets': [[
                            -99471,
                            26491
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MKD',
                'properties': { 'name': 'Macedonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ńOǤӺżȊ˺¶ϴbтˏÒ։ǅƑƥҕh͋ǿջõΑȴšήń˸'],
                    'encodeOffsets': [[
                            21085,
                            42860
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MLI',
                'properties': { 'name': 'Mali' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˰ƶƘӶˊpזɻӄǖ͖ÇŴȈ⁚^ȈךƣļЛ⋈Л⋆౾dᬼᆳᬼᆳȨϿԺʉ϶ƋV՗ठĈFካҟ֗íԭݛƃ଩ï̳̗ա՟Iȿǈҥš޻ΑǅʿٳϕŗɍΙǡНŔɱȳūֻڙۡp˳ɭΣÆӥ΋ůȝŁŽάʍĥơhƷʕ٭PɷŴŉùʱʎ¬ʢĿİǳĉ˚Ǥɐ΅ΚĳɴȇȂǙvȫş˕őɱǹΫäɷɈƓɕőƅAµ̮ʾí̽͘ʀǓӔԺ'],
                    'encodeOffsets': [[
                            -12462,
                            14968
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MMR',
                'properties': { 'name': 'Myanmar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӫηץϥࣥΟƳО݅ՔؗΈօ̭ܵ̃ƹȪу֖ڙĪҷ_ϵ͠ދң޵Сࡷăذʴ٠˯ӼæࣸͽѤ˛৔Ʊਗ਼εۢօуॕ׳ҽöԳȠ̂ਪǫ޾څॺļ̢ӭņ׭ۆÅڰ̊ŵj׾дȦęΤȐ˺࢈ڂȑϐۘ¨ЦҪ۶}Ӕજ׆׸ƱçԬ̎ƸÛ͈ӮÚˮӵξȧ|ٟۙߓۭĳঽࢲƔȨޛՐǍʓۣز́ζƷ؞ʔ~΍܏յǳ̱ӓȗ'],
                    'encodeOffsets': [[
                            101933,
                            20672
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MNE',
                'properties': { 'name': 'Montenegro' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÁǀηЯÊˋǫÞɽ˞εǖĢƜŬҦ˚ȜƾüɠƟŬśˠě͌ǧçïƽȋɧó'],
                    'encodeOffsets': [[
                            20277,
                            43521
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MNG',
                'properties': { 'name': 'Mongolia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࢮƢ྄ܤ౬Єܴʳ࢚]֘Ͻ࠼ௐɁࠈגͿӶࢊࢊश΍ނįনɍǈؿஜΛߐƺਫ਼ŌࡆōࠖЗԚѕެT੒Ƌޜȼૈƒ௸פԌĝѰ˭ৌêХهק࠽ɐ΅ӈńࠤŽ٦̴ڬˏހוğ̗ڏĦ௟ŏןʅ؝։౱͙࠷ѽࡹǞҿúѳէˎ͓ƌˣי˯׽҇গ̑ఽഫ̇এҋϋʾ৭AఓԜࠥŰૣśჃȊऑmӱԀϣޠԱĢ৩ԼଅŞুƞ̡θ͖চׅڲன̀۷Ѿəז'],
                    'encodeOffsets': [[
                            89858,
                            50481
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MOZ',
                'properties': { 'name': 'Mozambique' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@لæ৞ʁɖńגt̚ʦԌaऀ͜ڞӤƊϕ࠷ľ݅ಿƨЫʣ׷͙׍՗Եޏ͉ृСॉ͓ࣕƵוׯ΋ȗí׳ЌُǔӱZʣƪ¦{ࠗƋϷȤƝűΓΗ̗ۗ˳য়ҕρ̳ðΟɊÉíѵّRïϊůϖí̠ƬपɓװГஂࢬ॔ɜ؆ŶúĨӶƉʞغǐ׌E੠ѥ˒ЏÔǹȼϳǰ۫gÅ̼āװᢈۘӚЕɴüͨɅ¸͵ǯϷØסոԱʲ׌ζǰíઊΙ؈̣˖̅]ɽદɾٔ'],
                    'encodeOffsets': [[
                            35390,
                            -11796
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MRT',
                'properties': { 'name': 'Mauritania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@և־ԗؤ֍ɞГʚҵUЧǽйð˽ˏïҐɺаŀߊģࠨĵкČмɑЎѵδǾˬᾔMǃ௎ȴќ߀øᒸ᪂©F౞Ṗ᎟౽cМ⋅М⋇ƤĻȇי⁙]ųȇ͕ÈӃǕוɼˉoƗӵ˯Ƶ'],
                    'encodeOffsets': [[
                            -12462,
                            14968
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MWI',
                'properties': { 'name': 'Malawi' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɽٓɾથ̆^̤˕Κ؇îઉεǯʱ׋շԲ×עǰϸ·ͶͧɆɳûәЖѵɔʮޮ˄̈Ǉۢǚڼƞɪɉ܌Ѕϐ࠘ƽǜɵ˶Ϲɾଡ'],
                    'encodeOffsets': [[
                            35390,
                            -11796
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MYS',
                'properties': { 'name': 'Malaysia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@àћֈĶ˞ΈȘýӸԓΜ֛¶֣ęϡĆ˿Öӻ̒ɵͤݑe˳׫Éߑخ঵ښįђӟ֚ś̡۠ҜĠؔȃΤƤƮۈρ'],
                        ['@@أ˹ܯƚॱ@̅ॗ͓̇љୟۅǵߑɾЕóөщ՛Òէǟַӆƕ֘؜˽ٮǀǜ܆άǂ৖Ǻ׾ڔЬՐϦѥǮ˺В¸՜а٪אшڀͼHќыιֆɻ۬ʧÑ֝͡¥ƮЧ']
                    ],
                    'encodeOffsets': [
                        [[
                                103502,
                                6354
                            ]],
                        [[
                                121466,
                                4586
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'NAM',
                'properties': { 'name': 'Namibia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@رٌؖ͡ȃࠊȷ،˯ಒm৒ŅҞ͛Όѡۜѳ৘ǽՆۃࠐ»٢КǆԊƞհ}ԄϝŶÐ₮׌Е᎞ş໴΂یȒհµͨȍPéӁȍʭC՛͍ͣΎಕ̍س{ᲽࠣBយA᷋ݣѕҋÕՇǄϗÔƗάͩɰГг'],
                    'encodeOffsets': [[
                            16738,
                            -29262
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NCL',
                'properties': { 'name': 'New Caledonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ېԵѨϭ͉ȫҥɪ׹ϚէѼ։פś˶β[Һ˹φ˷ˎɻ'],
                    'encodeOffsets': [[
                            169759,
                            -21585
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NER',
                'properties': { 'name': 'Niger' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nּॹȐОҿպœϤâТբ̴̘ପðݜƄîԮҠ֘Eኬஈϒᝪ࿸᮪ཾ೨αӀңר̸ȸಯ̾ɓ`ˋΔ˽ǻί͕ၻ«ધੳߋγૉΔ̵CեբmčЃʁµˋƻm֩ंȟځҷٱʔҍ¸ʏşӯ~ӷΧѓq৯ѢЉȵѓb̿͆ࡅ̼ࣗıɕǻşӗʋ͹ÍݣٗӚ̟E˭ʗ'],
                    'encodeOffsets': [[
                            2207,
                            12227
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NGA',
                'properties': { 'name': 'Nigeria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࢍ̡͉¬͓ȉڥl҇Ղˡ؊שֆكYݍB¶തs՘ǂՊʶʴТԴėɨǔ͸ȍӾ˪ÎݤʌͺŠӘɖǼࣘĲࡆ̻̀ͅєaЊȶৰѡєrӸΨӰ}ʐŠҎ·ٲʓڂҸȠ֪ँƼnͬͯğƱ«˧۽ٱɛՙšѧǱȉǝי҅ΉŽыȋ͹ÿΓֽ˱ҽΊ͇aԃӭʑQЍ߷ɍש'],
                    'encodeOffsets': [[
                            8705,
                            4887
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NIC',
                'properties': { 'name': 'Nicaragua' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̃ˆϽͺȁ˲Ο˄сϜĤžƒŵÚÒʾŀȔŬRkЮȠrǬOǺɤʜǝĒľƺĲ̊ɴbǦĄQňȪĖ|ƜŹǚȆńɄB̈ŌŜŖ˾iïă§ȉĐ̫ȗ˹ěͷυ®ɏtϙŹĉýΫÌɛǣɋ ɩźƏȩǱʛÈƓǦˉêȕŉօɞųŇ'],
                    'encodeOffsets': [[
                            -87769,
                            11355
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NLD',
                'properties': { 'name': 'Netherlands' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۦyǀ˳Ƚޓɇ́ԍ@ƘࢡҥȞՏπީǩ؛âѠɲ݀ఆଲΘ'],
                    'encodeOffsets': [[
                            6220,
                            54795
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NOR',
                'properties': { 'name': 'Norway' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@᥆ؙઍɣऄՅෛ͵ڵû΢לઃͰಫ˵Ы؝ߟωࣗȮ઱¥णѼԉɝԷūփནƊɝҵ߭Hևױ࠿झಫ஁̨˹̇ͫ࠯bձ޿¾૟՞э˥ধֻۧυӛ֝Ԫဋঁ૫ȟ୏є̛ࣚˇ኶ޞզᕠ۶ဌࢂ໤୦፺ྴඦلᘼ੊ᇎπ൪­౮ۢ໖ພǘ'],
                        ['@@ም΅๝Ȝ׆ɐԕˎეǚͮ̿ொȍ'],
                        ['@@᪖صᑟͥұأ݅ǁЍۡৣᅵԢނ̘ఽʐ࿕܂ٷڄᘎ̜Ң̋஦\\͊˼௾੖̋'],
                        ['@@࿮̏ఝҍ᝱ı៙ƖƫɴஹdँϬᣴɼ௞ȫࡘʤᑺȽ']
                    ],
                    'encodeOffsets': [
                        [[
                                28842,
                                72894
                            ]],
                        [[
                                25318,
                                79723
                            ]],
                        [[
                                18690,
                                81615
                            ]],
                        [[
                                26059,
                                82338
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'NPL',
                'properties': { 'name': 'Nepal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÝαŌՕĩͩ۩aয়Ȟ٭ĂӛђଷŊયҼ߉Ю߿͆͜޼ՒϠΒȪڪʳࡔշҾť˰ЕٶǓۀσौȕঔć'],
                    'encodeOffsets': [[
                            90236,
                            28546
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NZL',
                'properties': { 'name': 'New Zealand' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Ȓ΋װ;ʐΡBΝ̹ϳչإїͷ̴З٭Yܗ̓ɣջӋࡗڇϓнʇޝlխˢࣱÐƗ̰Ҍذ੐ࠦժǀ׾͌ܜѰԎѦώظ͈ɆŰҶלϴȆΧ'],
                        ['@@،ࢫlָϜɯŲًڰ˛֨ãӒ͎юĭȯݗʯӫٛjɡʭþαūƻͅҏзֹ٭ͯƟɘΕŨӞ۔˟ҨࣛͲz̦؈̌ƚ٨լͻ֜vƪБΎڋݔΗת̸àҚұٺɑʂݡ']
                    ],
                    'encodeOffsets': [
                        [[
                                177173,
                                -41901
                            ]],
                        [[
                                178803,
                                -37024
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'OMN',
                'properties': { 'name': 'Oman' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ֹ̻ϟªǩȧƉэļ֗ÿĻϯFԽ̻ćХȓǯԹP͡ɃJͻПɷҩĂ֗˳ϱ³˝טٿ൴ᠾ࠾֖၂ϩתv͸ʔΐFΆϞǒƩŞèմіHϖֵҸ̧؞ŋӼƳϜӕɨ˧̞ŃCȉ̩ԃƅɽΟˏ'],
                        ['@@ŉƳǅ˺ʔ˺ľñā΍']
                    ],
                    'encodeOffsets': [
                        [[
                                60274,
                                21621
                            ]],
                        [[
                                57745,
                                26518
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PAK',
                'properties': { 'name': 'Pakistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@تϻʞ٥൨ͻ߹۷ऩůౣȲЫα̖݁̈֩ڴгܑӟ`׳ࠃࡇՃ࡝࢝ࢡউÚऑࢡռϗĪ٧ҾэǘܝᇛD֓֕؛Ɇʣ؀٭٘໻ǁിeஃŝ̈́ঊொѢéϰГƌw݊ߥφͷԔеѶඨѕࡀŲԈŅǞȂגóદΔ܎ҶӈشCĠɼٞŌ̴ý͢ʀ±ԌΦԖ՘Ɇͥ֊ߜɴ̢͒мΜĩмȣΤӬμࣘǮ८ĮѐƺӨĦ'],
                    'encodeOffsets': [[
                            76962,
                            38025
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PAN',
                'properties': { 'name': 'Panama' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˫ʎǵҒȺɢɅÎƿˤлɸοÁǝ̇ͻɁǽĉǩВҗɯŅŧŭϷ©ơԈŋƛˡ¸ǝ͸·ÈɓİέCǻĩŶªǖìǠƲŲĲǩŲK͸͘ö̠̝iǱͲĀæɴȵЮÔΨɄԜǞ˺ʤҬ·ĉҶώơ˜ʧ̈́ɵĹūȜӵǁʟ˓ÒŅС'],
                    'encodeOffsets': [[
                            -79750,
                            7398
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PER',
                'properties': { 'name': 'Peru' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɥљћɋࡅӘñΈရࡊທࣾ٫԰ΏۜƐʎ܅ાࠣ༄ߍီ΅Ϥ˃ؤٷպױͼ˖ϒПߢʼךڢՎĲΓʇȧx̭ΎâͼĝΚщӆΌǄ֤ԦܶৠͨࣸࢠʾմŝٔɢĂ֒ЉˎЅϴɏӶࢣضĿҨɞ̤ƣԎð٠Ͻթࡣʤoрҁݳ œųۍǉ॥ֱÓϻɉ̇ČғԕʍBΡɛƵΔݳҲԝǱί֐µ͆҃ݐuېӸÇ౧ϢĩӄƠܪടǷ˵£ןg܍͟пƮ̵ȕ˯β۹Ջ࣡'],
                    'encodeOffsets': [[
                            -71260,
                            -18001
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PHL',
                'properties': { 'name': 'Philippines' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Đ֏ºҽ˹ޑ̫ࡨϽэˎإʉϿ঩Ӧɿ؊ʰЎՑЈˁΑЃثҵƑʖ͢۾ՌʀҜ̈́̔ϝٔɰƎϒרv·ٰڼЋêхÐ̱'],
                        ['@@̟ˡˁՍ˃ʝԫ׈ǦɤɂɾĢԸҨ¸Ɖ֣جߺāߡ'],
                        ['@@ૣߕЬט؈԰Ԏ׊Ѱ࠲Ʈۅևҧѳֿ'],
                        ['@@Ԏʹ՘BgΗϳΣՕʧϸÒєŽА'],
                        ['@@ʀभ٫ɞj˭ȶԯЍȋעʧªƁԘӶãY͈ԣٜ߮mɴ̻'],
                        ['@@ɟܩέоѓ٘ܚ̡̈'],
                        ['@@ԮʉʶɖüɇƍΑ˼׻ɛۥӷ˥ƁڳȊڝѾġϊĲਾүăҙ˜ȫēϯٻЮ̵Ѵɍ̯՗ԊރůлȆ¨ΎˀɊʣȘŇ̡бӚűμߨͺˡĔೄ˜ހԘA']
                    ],
                    'encodeOffsets': [
                        [[
                                129410,
                                8617
                            ]],
                        [[
                                126959,
                                10526
                            ]],
                        [[
                                121349,
                                9540
                            ]],
                        [[
                                124809,
                                12178
                            ]],
                        [[
                                128515,
                                12455
                            ]],
                        [[
                                124445,
                                13384
                            ]],
                        [[
                                124234,
                                18949
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PNG',
                'properties': { 'name': 'Papua New Guinea' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɽčε͔ρՔǷ٘ŜĆĜʡʬȏРՑЈ˵ŝɽ'],
                        ['@@ѯçƃɽҟȱћȟѽBۏʔӑɺêʺݬũҠàŶЖŦrĆѽӐÜʂ˼Ҹ̚ġӸԌfǜƏgү˯ԡ'],
                        ['@@ݤտղࢻӖω٬ƛʥǁࣀΝġʏ֋ÏȷɔܟĦࡕŴٷ՚ӉҦѧ݀ભπ܇ʇԡˣńإڇ˿һƖࢅaᩒaᩒภ׃༊ӓׄїҴхŸӵඔԱȲѽޛěȄ֕'],
                        ['@@ʿɡǁӸȝ͘ϝ˞ӍΪ؇ʚɺȮҒɻ˸ȁΜȫʹΛ͊ˏĶѧ']
                    ],
                    'encodeOffsets': [
                        [[
                                159622,
                                -6983
                            ]],
                        [[
                                155631,
                                -5609
                            ]],
                        [[
                                150725,
                                -7565
                            ]],
                        [[
                                156816,
                                -4607
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'POL',
                'properties': { 'name': 'Poland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@·՜à̂ȹ̧҆̚ɺɤȝђָʘ಼ϴ੒˴࠼ƙÚȱ߸Yਚħ໶^њěȬʵωɸ͋KͯԋǡʸϳfϏцܻěɽзįރۥɒϗǿ¶ߙ͔؁šЇĒӹǵч̖Ήŕ³¼ϭаر¼ăˀֻĦűɑҗǨÀɴػòЉ˔'],
                    'encodeOffsets': [[
                            15378,
                            52334
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRI',
                'properties': { 'name': 'Puerto Rico' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@јõưǕɋɃمLӫ·άŢŬیK'],
                    'encodeOffsets': [[
                            -67873,
                            18960
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRK',
                'properties': { 'name': 'North Korea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Şƥ͉ºη˵ʣ˷׽ѣȅƫƧ̓ʝ֓ƏηɥηįġͰƋӈσŧȭΧÇץ¡͝ϛϑÁùСǆĵƿʙéǀɑüɥƆɰφȤİõƶɆҒÅƎөĠЇɤۄբऒҌ־׮ЎˁܪſѺಚβͰҼժӹ'],
                    'encodeOffsets': [[
                            133776,
                            43413
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRT',
                'properties': { 'name': 'Portugal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̦Ɉ΄ŬɂЫӺDƞłӪɼуϱɩYٽƍūЇγçʹԋɵտ̄ʡřɫ̵̿ê˥ͷɓѷŠџġŸڂÿԬϓþȩ͈äռͰ̨ÒͼǪԎkΤǙ̠˲'],
                    'encodeOffsets': [[
                            -9251,
                            42886
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRY',
                'properties': { 'name': 'Paraguay' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͦ৖tҌЖ݌าʔޮ]޴їbʵʞҳÇଛࢲǇ΄ǐ֦ɩǀʣþޓİ͓̼̀ƌ̢ƳAҥŕӻǑӛƍݏށ١ړƇऻŸࡑɮࠢ౨ťψࡽ͢ਅبۉŸ໵ൌ'],
                    'encodeOffsets': [[
                            -64189,
                            -22783
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'QAT',
                'properties': { 'name': 'Qatar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÇؔɨѲɰĜʬˁdӯǽӳɵÑʫǖ'],
                    'encodeOffsets': [[
                            52030,
                            25349
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ROU',
                'properties': { 'name': 'Romania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@δǶԴġՠGϸȳ˺źبĄɄȠΠ@ʰćʺʟˊΟӞԁρėΩưϥϒƹЂƊϠƟpɏПǹʯĀɻ৥ӳĖ̪ؑফțзɋ௽¬٥ƀ͙ÕʍΊƵƦȚƘȷŀ˃ȋөʔßΌԟȢĥˌҕͤڪǂԖ֮Њ֬ԢǮ'],
                    'encodeOffsets': [[
                            23256,
                            49032
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'RUS',
                'properties': { 'name': 'Russia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ࡌ๫కˤԫ்ࠌࡳyוُԒսٱƻ۸Ĥࠊħ࣢Țٌ૴ӯࠜôରަϮͭϴϐŠɔ։̆ߵuࠟΎࡑ'],
                        ['@@໵]ਙĨȒτ୊˚ࢢƧψƃęɱäɉ'],
                        ['@@֦Ƚțؐᗸű࿨޻࠭λ൛ēsࠑͳǩ޽~ٗ̊ૣʖȉθ࡟Ǝॗŉҗ̎Ǽ̸৓ȥϚЃӉΣ@„Ꮪٛᔺ࠳ïԷ'],
                        ['@@ः©ƭˌੲΖ@ַ'],
                        ['@@ળ»@ָň܈E௒ʉïŗࡽȩ'],
                        ['@@ౡMႣĤƧ¬ߘͪੀþஞ͏ĸə'],
                        ['@@ॿͩഉø༛ͨȪ˖༨ųᑔɗ'],
                        ['@@ډرᶽzඃȣမղҎ׀૎ǂᕞᴬѽ'],
                        ['@@ӹóᩣŊɟώູɦūҒ࡮ǶҞသܒޙĺ፨݆ɩϢሤѺ᪪բ᫠ǀ෴̸࿐Ŋאͩ֟ʻᲗз᢭Џᤙߝఫࠍ೉߱Ǡۥྎۏ'],
                        ['@@ɨгސȲឤYቈЧڬ̿ȽѧङʝᕅүفʟਬşఖɃݴǄєաτɔഊƂ᧪ƑȴϽ↲ů´ٜᄼƥഄLബѷϮ՝ӹΙੌڋ೔Ϳ߸ࢦഖϙ෢ɦྼʵؤʀൖş؅ޮૐζ䢀ձܐӿᔲٛ₎ǄာƑ۪΍Ĺؙਜʇ૴Ǥ๰vཚǑཪĢะݛਪˎڷ՞ϐώᧆɻფºᝂБ୲ν@”MKઇσઝÖݶҁԄەϲɧĮΏɑɝ༧Ǿ᚝مݛĭ౽ן௛ԧ̱ϣய׊ᔗڇϣ̸ߵΫ૱Ř˓ց৙߽ͻड़ȋő௣ޭΫ۱Δα฽ѕ̅ॡభȳʥ࡟ே޳ׂ̳έ௬ҵለИ୘܀ԆªϾರȊຊ੒คࡺຢڢڮஆ৷ëԍۗᒉइۍਖᓧ˷ᑃටۚԧሙɕಝēÔ؊ಯŶ਩ЭᢵƠ᪏ʟᨩ࿛ủጝ೚ŁаՃࠄȅ՞оईÃௌऍ܍ځ࠽ë্ϛഉ్௓˯ׇଙ঑ଇॻթӹ૩ӱՉYՇФૻؙſ˩ŝƦKѐіxŦ঴ɛܚܞ̒৶Ʃ֢ࠈ˾ऄ͚̮Ѵݲ൷ʛܯͧ౧Dͻ߄হװหˎ̵ࠖ̉Ԫ̿βԯࡐ̲݇షʢ૛uਯƱۛлҤȥXҩұˑݷࢻRσஅՍ৙̈́োéѯˮԋĞ௷ףેƑޛȻੑƌޫSԙіࠕИࡅŎ੝ŋߏƹ஛ΜǇـধɎށİवΎࢉࢉ΀ӵࠇב௏ɂ࠻֗Ͼ࢙^ܳʴ౫Ѓྃܣࢭơ͡çѽԤઍőΧΦחǌЙӠҩưிɍୃӜ҃ѯሟᒒੵٮ̮˂ᑋߍ߭³êҞઅ˺࢙ȱ˃ࢊມǺݯΑᑅ̳Чȹḭ̇ϫ˻؆ֹ߭ɓǀɭ߭ХസֿɁЉ୻ʓʟ੹Ѧ೯iࢻΟহͼᇡ׊ಽsჃࣳĿؗࡹӤڡउʖǡӝُ܊֫ذx՚֗ďѝѐƋϥӽ߿Ƒ࠳ࢁކߕĉ֣ࣼফԇ͹ƝɇωÌֿԚɿՅȚʳΈ޵ǮԙƁƥƼଥЖఅƌ܃ƞĹıੱ܂य़̈́ܩӴؒƈۤ۰ҹͪఌ΄uȀݯƉώѠɼ߼ÖƄ˪ȅҪ΀ѰWʚఉ˚ӭUԯЀ١ƃ੩̐lǒ̗θڟ¤éʼɀǞ՝ӈࢋąʭ¦Ƀȑ̽ȷ՞ȟ˨ǊĀڴ͞Ȁʍɢ֥ƪ¼Ʋ΁ƴՃվǸɨĉЂࠑȨѱĳšȼࢭɂˑӸíТЙȖάˊʝ޶װӞųƤक़ҬࢡЎᅢ੶ޮӠ͂єగּΆնݳش֢ܜ঍ग़ޢي౿֔ŬךڶüොͶࢀ̈൦ԕᘨȧṺो٤ЋÆ֓टѳ൏ɡ⏷ٔ؟Ńൌ؛ÂϵÆ࡫ઌʯڂɓňРԑΰ՘͈᎖Թ۾Ȳ֣؜ዦࠖޢµ޸̋Ӫ׀۫ԄЪԊءԶᚠˑӔҹ੡ĻNҳڌ˽ಜǼȶ՚ჶАᰪܞي£ࠣԙਬĕ׼˼༾xఢΐफ़ԏॖ֌ࢡӢѪˤ២ʫ୒ʿᴾॣ֚ѰࡡѺ{ǴৣĈˢЌ҅ټ}ː༄ݾրކزǒᕮɛǬұߕڽԺˋ˒חȏଵऒԧέ֕࿫஝०ŭ̢ͮऎɎɞжܮЎөӌϼֈࣿêȫҲڢࡈણۆຒ֦șװмnѴүͧ߷࣐Ƶϥ؄ඤͦლ¬༈ӏݛ۪ċࣆศǞ፾ᆘŌہѮংւॲx࿎иᕠŐ˪ɲᕂþیȋሴҀ໲aɶδߤΨጤΈ෸˗ଥȷበŹ'],
                        ['@@ⵙ͕ໞીےĦقÃᒈӋʟͿ'],
                        ['@@૽ōݱÛśƏঙƑ࣫ȦӐʾል~࿞ƶ౨XǢɧӘȬߊƐఞǿ͗ŷ'],
                        ['@@ᆳĿᚉʎඅ͎٣׾଩ǔᔆָᆎȎ࿌чኬ߻ȹݯ']
                    ],
                    'encodeOffsets': [
                        [[
                                147096,
                                51966
                            ]],
                        [[
                                23277,
                                55632
                            ]],
                        [[
                                -179214,
                                68183
                            ]],
                        [[
                                184320,
                                72533
                            ]],
                        [[
                                -182982,
                                72595
                            ]],
                        [[
                                147051,
                                74970
                            ]],
                        [[
                                154350,
                                76887
                            ]],
                        [[
                                148569,
                                77377
                            ]],
                        [[
                                58917,
                                72418
                            ]],
                        [[
                                109538,
                                78822
                            ]],
                        [[
                                107598,
                                80187
                            ]],
                        [[
                                52364,
                                82481
                            ]],
                        [[
                                102339,
                                80775
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'RWA',
                'properties': { 'name': 'Rwanda' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͬӃµӵʏŁѿÆʱӍԛàþҠŘÞԄʎɺȰďԈʸ'],
                    'encodeOffsets': [[
                            31150,
                            -1161
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ESH',
                'properties': { 'name': 'Western Sahara' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@oҊŸ@@ÉeǋEౝ᪁ªᒷ޿÷ȳћǄ்ᾓNǽ˫΢bCቆäĶ̢ΆϘˤୌୠ࣢Ђ੖ˀÖ˜ټۺĜ̦ŉϢ@˔ȒԲ'],
                    'encodeOffsets': [[
                            -9005,
                            27772
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SAU',
                'properties': { 'name': 'Saudi Arabia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ŉΪʩʨÝͲѡ̞҃۴ʁۆׇ׀ϑƐ֋ߠīאӾӕञϿ͠ґǨˡӖ°ȎɹѦʕȊ͝زԟڴѓ־лIžҦ̌ļͲनƅζʶȪ̢ٚŚƒˮˤƜ࠷ࡀ၆фǆŴৢɩబיᛎၕ༠ãݠąȾЏתv͠ܥаȓƠִ̏Λ¼΍ċ˩ł˯ʎɽŐ˟ŲȵʬǕɶÒǆ͍ș࡙͐ᡌщǞǲϪש֕၁ᠽ࠽ᝑ͑޷ϙ׻ࢥϹƕɁˬ͏§߻ĎƷČॹmɫùΉɔɝЭĒΟρˋ'],
                    'encodeOffsets': [[
                            43807,
                            16741
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SDN',
                'properties': { 'name': 'Sudan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@śhdмĵ̀џͨĵ؄ĶبϳÌÍȇԍ©Ȭʕðԍңңл؅џđ۹Ӫͅǥđʓџǃǥ࠵@řǦ؃̡ƝɳîѝӬƟɲ؃ŗɱϵɏݣ˿ǁʳğå ̅ʎÃʼƌΔE΄ӛՀĩάZȰ̱ʜUӦǭ͖̍µĎ̰ɒΖħΐˢʴǫȞɞ԰ϨئܦÏ¥ ZΚॲH@း⁪@Ὂ@ῼ@˔ࠗȁƳŪࡻ্̰͌ȷҠ̳ыӑأƏ˅ʳĉ֑α௿ĚͳƅܟͿࠟԓзέٛč΃Љɽʝ࢟Dĳ'],
                    'encodeOffsets': [[
                            34779,
                            9692
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SDS',
                'properties': { 'name': 'South Sudan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Xٽűʯѿq˷ӏԨÑюХƨͳϦșӼࣳ֫օԫԇԫϭסFگȟՕȊ΋ɭ݉֐ȥάҵǱϱÆɣƕϗĸԗۚƉˊعͪɅԌΕζ֟ѬS˘ҡͼ֯͠ʴĠ̀ǂɐݤɲ϶؄ŘƠɱўӫɴí̢ƞ؄Śǥ࠶@ǦѠǄĒʔ͆ǦۺөѠĒм؆ҤҤïԎȫʖԎªÎȈϴËĵاĶ؃ѠͧĶ˿cлŜg'],
                    'encodeOffsets': [[
                            34779,
                            9692
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SEN',
                'properties': { 'name': 'Senegal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@΍ٺн̚φǄРמȦќ˾ːкïШǾҶVДʙ֎ɝԘأֈֽԹǔӓ̾ɿî͗ʽŧ³қâÙģȃk׿ȲЛV༇ɥħ˥ѻƋƏ٢ވkȬŞƮR̸ȘήǯκcζȌǝʐˡƙʻJͧȸˉ_ȍȥࣵy'],
                    'encodeOffsets': [[
                            -17114,
                            13922
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLB',
                'properties': { 'name': 'Solomon Islands' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɾ˿חN͉ԬԈȯǜ'],
                        ['@@͝mԧĎǫżÀͮֈƁ˜ǭƎə'],
                        ['@@ųƹحܰǫԈ˺@̠ڥʹЗ'],
                        ['@@ǛڅΦҟ̠̿˪ŰĐϮȫېϭȢˉ'],
                        ['@@Ǘ³οȒ·Ί¨ƖԈΡͰ˛']
                    ],
                    'encodeOffsets': [
                        [[
                                166010,
                                -10734
                            ]],
                        [[
                                164713,
                                -10109
                            ]],
                        [[
                                165561,
                                -9830
                            ]],
                        [[
                                163713,
                                -8537
                            ]],
                        [[
                                161320,
                                -7524
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLE',
                'properties': { 'name': 'Sierra Leone' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɧØ؁ͺѩ҈Ƨ̬Ĺت҆τĬɺƞǸɶpȜǂڦCɺ̛ǼΛʓƈɗṶɴ´ϹϹϛҗ«ʓȩˏ'],
                    'encodeOffsets': [[
                            -11713,
                            6949
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLV',
                'properties': { 'name': 'El Salvador' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ġȡӡ^̡Ą΍ǘұÀʃǶ~Ů˾ɄǀĢ«ĲȠ¾ʜëǸǙʪƇœτĴǤÑŘĝÏͳ'],
                    'encodeOffsets': [[
                            -89900,
                            13706
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '-99',
                'properties': { 'name': 'Somaliland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ϛԩד۫۹Mᩧা͍̜̳К̳ҨǾ̖̲҈˚ƹǒΏϜΗкGߊɌࣴĴ݌ʼиÆ̚ƶӎKaE΋Aࡑ@ѫ'],
                    'encodeOffsets': [[
                            50113,
                            9679
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SOM',
                'properties': { 'name': 'Somalia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ѼĎЊ˾͈FpɵýӧHѳǯ̣ʁࣥЙयԱ੷ܝ௷ܓवধ଩ࡁڹష࠯޳ٕँৱȗѷȍȣӽۚWᵤܾ॒ɰˆբfݠפબᛜᡄה۬ϜԪ@ѬBࡒFΌLbːhϰŰ'],
                    'encodeOffsets': [[
                            50923,
                            11857
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SRB',
                'properties': { 'name': 'Republic of Serbia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ԡȡà΋Ӫʓ˄ȌȸĿșƗƶƥȷȏø̫Тγ͋ʿƗˋĞĳƑšϳa˹µØĴĴĦȴšKǍƼƑ ŋƆƽÀšŠƯ±ś˧ȩÑèð͋Ǩ˟ĜūŜɟƠȢŬЄЛ͔ɀτ̥Ë͔́ˉʈȱ͘٢ɚԾҖͣĦˋ'],
                    'encodeOffsets': [[
                            21376,
                            46507
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SUR',
                'properties': { 'name': 'Suriname' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@৔ǙĞưڶÔࣚɥѩܟâֹͤӽƥίóϩɉΛӓǲЇđ͹öčʏƘǗ÷ǡҙèԡܴōӄˏBωؐƺѠ¯ȤԜɖƈݲ'],
                    'encodeOffsets': [[
                            -58518,
                            6117
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SVK',
                'properties': { 'name': 'Slovakia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@´»ΊŖш̕ӺǶЈđ؂Ţߚ͓ɷɓǏ͹ǳđ࣑ʮ˟»ȟȡЁĿěÄХŽͭ}ãǙ۷Ļ̱ĠёɌċ̆äńŢȂόa˺Ĕxþǈ¢ÆȒȖžưʢD'],
                    'encodeOffsets': [[
                            19306,
                            50685
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SVN',
                'properties': { 'name': 'Slovenia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۜÝъȐܾtǈƘƘUǎ˳ڝɟć͹̇đHɻͣh˷ƎƷƙבȈúȫΨĞа'],
                    'encodeOffsets': [[
                            14138,
                            47626
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SWE',
                'properties': { 'name': 'Sweden' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࠁוƀԥ೹ڭྱܡؓஃײףߦүޗॅ࢑ȝ͍තӋ޿৳ĆӅڗঃˉߐ۳॔ٓஐφӜּۨ˦ন՝ю½ૠղ߀࠰ä̧ͬ˺ಬஂࡀञֈײ߮GɞҶཔƉŬքԸ૪Щ಼ֱv಑˴͛ฃʃ'],
                    'encodeOffsets': [[
                            22716,
                            67302
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SWZ',
                'properties': { 'name': 'Swaziland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǡύӭěԅҖS̄ɰ̀ĂʔʐÒшƵŰϕðω'],
                    'encodeOffsets': [[
                            32842,
                            -27375
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SYR',
                'properties': { 'name': 'Syria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@࿩ࣅऩͬgNŖŶ_ΈȸҠҜ̈́Əͤϗ¨ÿٞȶΌɤȀɤȀ°Ҹ˞Ǐऎɺ҂ƿۖFॴ̀Ґaक़žїԽҡȹĂؗͅ৫ᇵ࢓'],
                    'encodeOffsets': [[
                            39724,
                            34180
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TCD',
                'properties': { 'name': 'Chad' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĎЄաnDզΓ̶δ૊ੴߌ¬ન͖ၼǼΰΓ˾_ˌ̽ɔȷರࡔҠ…ྑ…ྏ¦ ܥÐϧإɝԯǬȝˡʳĨΏɑΕč̯̎¶Ǯ͕Vӥ̲ʛYȯՏƛэͽ؉ࣹ߅ϳ߹¾ʁûĊ̏ѫ̋Σ͟੓͏ȽȐƓhƹɍۛÙƀɪ˅ׄşΐλƜӷӪǼІϦċʂÐҸSқކ֐É֐ͭՠ'],
                    'encodeOffsets': [[
                            14844,
                            13169
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TGO',
                'properties': { 'name': 'Togo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ڱǳȇ̎ɡՔãкȆݴɁ̬ăڎD؎ΕѠÖˀ݂kŅѵʲʝ̈̋ЭǜǥኝȺׅ'],
                    'encodeOffsets': [[
                            1911,
                            6290
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'THA',
                'properties': { 'name': 'Thailand' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ݭϬܗeŬڈ݉Káऋґ௯˙ݏÌ؋ն΀ދưܭҶӓԚĭѤѧ˝·ևĵßќۇςƣƭͧ͒ƝжҁӄПЌƏӳǃҲĠԾʚ߬ТࡸҤ޶͟ތ`϶ĩҸ֕ښȩф̄ƺ̮ܶ·ֆՓؘН݆ΠƴϦࣦצӬθӔȘθʷ´ԍ֨ȷࢭpݫࢰԆʤƧӰzǜَ̊ÍٖڽÀࠥںܷ܅˙ϛ޿Ŧગǅ՟ۧȤ১'],
                    'encodeOffsets': [[
                            105047,
                            12480
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TJK',
                'properties': { 'name': 'Tajikistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̭ʷࣳƖāӛ࣬Þਢ˗འŶɈާˠĐԜȓ͛ŴӍࡿBׁØԻϕύĉ̉ǯͩˠþ۸ʩ¢ĞʲғȐα̇ė͹Żūԇj˕ϩ˯ǌ؋ˑʱĺӀࡘǹض؟ȨɔφۮЌҬˌբ૲ȜǩϵŤɹΎv'],
                    'encodeOffsets': [[
                            72719,
                            41211
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TKM',
                'properties': { 'name': 'Turkmenistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ñۼطॣݔڣĠगюׯþσƽ֙|ׯӓ݇ǋƻרŪ࢞ٽ˶Ɏֺ֏¸Ȇ۾ߊȵ݈ˎؓԎʉӔڱɋď؛ʿհψ˨ॖǪ֨ɻךڅњ¤ॆ\\Əцܖ̂۾ӦଆѹĜڡ͐ǣࣦˮƳаࡽ०ׇոЃ࢞Щ૤ΫwԥʩЅɤſ̙۽ǋǙڥӁʭڏŵǫϟهŏࡩ͈'],
                    'encodeOffsets': [[
                            62680,
                            36506
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TLS',
                'properties': { 'name': 'East Timor' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĲȤܢȌזˀŀ͆Ľ̯ɫ࢕ο۳ʋeʬďǔ'],
                    'encodeOffsets': [[
                            127968,
                            -9106
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TTO',
                'properties': { 'name': 'Trinidad and Tobago' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӚŊǮصۭġƯúʒɲiͪ'],
                    'encodeOffsets': [[
                            -63160,
                            11019
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TUN',
                'properties': { 'name': 'Tunisia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ΩພԭͺQȰۉԄóنԮҶȢۚƃߠǠќࣶͺךĵ}ы܊̲ÒǉпЫMϱ̆ȽōܫփхǄқѤaɄЍ͊ſ³٥Хʋʵˏֽ͓ĘΑïΟЧț'],
                    'encodeOffsets': [[
                            9710,
                            31035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TUR',
                'properties': { 'name': 'Turkey' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@஺͗ঐżܤõলѬࣆ¢ߴЭƜ̑ăУزȻͨʕֻʇˀ५ǏʻҠڧЕƙ̏Ɋ঍ňίŽॗŽҏbॳ̿ەEҁǀऍɹ˝ǐ¯ҷɣǿɣǿ̱Ϡ͈͂ԟí۱ȖֿәౣĥڹҊࣟȗΑׇĳ߻҄ࣻeӽ࠶ؗҰЦٸՓВठߨಒΜྀٔŏ৞հ঒ʄർlุף'],
                        ['@@۫ҏ˃Ϻ\\ǦȦĦʺՂХɞࡦ˄ܤőĴ͓ܼ˓Ƶȵি±Ωʷ']
                    ],
                    'encodeOffsets': [
                        [[
                                37800,
                                42328
                            ]],
                        [[
                                27845,
                                41668
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'TZA',
                'properties': { 'name': 'United Republic of Tanzania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƚġᵂႋÌӣ஼࠿ϱਙ¸Ӊՠ̩~ɓɳԓ¶ʭÇГ̌Ճΐ̰ࠡǿڝӣࣿ͛ԋb̙ʥבsɕŃঢ়ʂكåɽଢ˵ϺǛɶࠗƾӉʨՕƘͯƘΗɈґ੖ӣҺǗӤČѨƯޞΎ ̨̦͜ѬȺǮS˘ǷȐ·ͨʐł¶Ӷͫӄ̎Ķऄ[ႎà'],
                    'encodeOffsets': [[
                            34718,
                            -972
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'UGA',
                'properties': { 'name': 'Uganda' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ः\\̍ĵԇʷȯĐPوȜ͎²ڬǰϸ͎Ѭ͔ɠ˒̘͵Ŗ¼চΌɮՖȉڰȠעEԬϮЊ׍İсτ९̧ؓЯ֋ʉͽTࢹႍß'],
                    'encodeOffsets': [[
                            32631,
                            -1052
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'UKR',
                'properties': { 'name': 'Ukraine' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̾ɄȒʮ¥ࢌĆ՞Ӈȿǝêʻڠ£̘ηkǑ੪̏٢Ƅ԰ϿӮVఊ˙XʙͿѯȆҩƃ˩߻Õџɻύڡã֑˕޽«ܣ̻¸ԹЪȭࡨ¼Ǐ̛ँơଛӟұǠȄЂࣽʘƨǈߪ˪ʑȔಯɆË̼ީĻ̷ҧٱةϟƠЁƉϑƺɂĞƦ˾ɲˎÑƮǬäĊśӸ{ɞØƽĎÐŲ̉ɈŧΘ̩ƐÒ˶ϝɦΉأʾ֑ĉȧŭΟ@Ƀȟاă˹ŹϷȴ՟HԳĢγǵÍɤұɮǐͺɸɔȀµɑϘބۦиİĜɾхܼДҢɪٲnࡖßबȫڎi͂ŧ̀Ʀɚȝݸ¢ͮąÄцʶȂܞº'],
                    'encodeOffsets': [[
                            32549,
                            53353
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'URY',
                'properties': { 'name': 'Uruguay' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ղĚࡆٯ̺|ࡺ՟ڈҫӠֱχЉɸӇεՇॉұاǚғěޥΰ֫ԟҬÞլǾȈS࠸ɤࡺȾڦ'],
                    'encodeOffsets': [[
                            -59008,
                            -30941
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'USA',
                'properties': { 'name': 'United States of America' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ũƕȽŤ|ɾƓ̨¦ĤƤƎÍǔ¸þÜe͐ƙƬñƌőɊ̍q¯͟ǵˏſ'],
                        ['@@˭ÑƟǮīèQÀĈî̘āɘŹëĵ'],
                        ['@@ĝ҉|Úĸа'],
                        ['@@­µÓŻŃȒɤŚêÃʐ˥'],
                        ['@@ıĉ˱ƴªÖŸĈȘijȝ'],
                        ['@@Ƭңʼƛז½࡬ƅࠂʹڼŊਖɓ˞Tݨʄ߂̧ࠒ͗ں˩ٶˏĈəȢĉ½ĉɦǎĔ¦ȣǜƅɴ@ŬĹĽƫ࢖ЁǶށǚܳʗӹЁҥȁ̍mēĦť˸Ɓɂ@ঊ҆ࡾƀસмfĐ÷ʰƉǒϜƆࠜHޘAˎ͞ŀàࢶ؄ϜƸ౦N໾BĎȺː¦Φž̖Ϣʲٺٚي˨ə֜ƜώʏAଧռӅƢ˝࣋Пࡷ̃ࢱʝѻӿƛȋSѽˤѽΒsė̬ʦȇãʇ֥ƋЗhةƥλ¥ӥ¥۫ʏఀǂʠǃ୳ʥ՗C|ĺʭɷʚǹ׽ؑ٧×Ɏȁª˟ɀǪҍȼƭ^ͅˏ͛ҿڡûʺֲѕ͎įۦǉεǴՑևƀׂ˓ߛʊÍĖ̃ŠࡁՕدࢇʝցӱнÁэ̱ţ˭इձӁЍЅӽŻׯƪ׍ˬܗώשLεЊঅ֥͛ȿԡʣŃЯĺƁς͋ȖѻܢϹٞű͢Ǥ֐ɽҦٻ۲͟źࡑϡƭ¦СϼՃȺोŁݗĤٙÍΏſƲɟaͽǴǓǇō̵Ů́ǃ؍طѺܻĿ؏ȚԹÏۻȝއح࠳γҝБȕϗUׅ¨ЕǄ˹͝{׭ȂٽʺɽЄȁטӷӐ̃ӰуֺףͲۉgՉڑۣʦѡʪȽҦ˧Ѯӿτїˈ̩̖ป@C΋ڗ@ဩOቿפ౓ТĀǒ੩ĝॕÝƙіխӚϻĴğʌһ¦̝ɪޭĊɉƌĹҢࠁࡊ۩ୠȚχˤٯ۴řۆ҃ҞȀۢܜˍ٢͠ߊĸނĺނƱૼˇܘʓ϶ĸǐ௒˷҂ߋȺɜƇې˷ێᛸ@᠂@ࠜ@ᢢ@៚@ᡀ@ᡄ@᭰@ᮞBაAF͔˴J'],
                        ['@@࠽͋ѕɐŽЀބ̘҆Ÿ֐ÉΤʻܫЍ'],
                        ['@@ԧŽսƾԛɮࠦƞښùĂ͑'],
                        ['@@԰ǅԾĒڸɛ࠲őéĝُǱٕǾ͋Ʋݍµȧôº̈́'],
                        ['@@؊ϛώǌහ»¹ȕ౾ƛࡨČᄚ˅ྤā٨ŉ૦Ǝౢʧࣲŝ@@MᷱIⷍࠠ{ࠌɵהρݜցࠈҺࡈ˖Ҁѡ֤·ޒϙՂ׽࡮य़ේ՗xՋұЙҥ͂ݍˌʃܺએںҍߎ߯Ä೷rটʌ჉ࢎߩǄ฽̜୑í࿻ϬৃΨटǯǦ׏ҫÁঁǫ݉˱झǳťӶϚࠚࣀʶɱɂੱҵֵ֑௅ױؚСߏ׿ࣗΗࡁʱȻωಽѡ˅ϿছΫֽÞ޷ɻ࡝˹ۧ˫෹ʉſƘऀϾࠔʸࣆҠਬĨвΈ୘ԊȈǚب̒ƢْђӸॹʫ˓Ơҕ̧շюɧ̝̽м࠿ͳԩBïԄƲ̮ե̚થǇ܁ЀַȬIӈ٩Ϊ͘ӘۆҸ̚њںÖ־ƇڴМ؎ï٘ʼƻϨҹưج͖ԩWࢻǽʯȃڏȄஏĥ௷ȬΛ͸੟Ӧ୾ΘመШ۔@ŕнᄢڽԶਕ͌ױр߫ΨଽˈҺѲ๰ਗ਼ϦȨФ࡬ЎࠊĪཪώޜÉಐ҄ౚǭ']
                    ],
                    'encodeOffsets': [
                        [[
                                -159275,
                                19542
                            ]],
                        [[
                                -159825,
                                21140
                            ]],
                        [[
                                -160520,
                                21686
                            ]],
                        [[
                                -161436,
                                21834
                            ]],
                        [[
                                -163169,
                                22510
                            ]],
                        [[
                                -97093,
                                50575
                            ]],
                        [[
                                -156678,
                                58487
                            ]],
                        [[
                                -169553,
                                61348
                            ]],
                        [[
                                -175853,
                                65314
                            ]],
                        [[
                                -158789,
                                72856
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'UZB',
                'properties': { 'name': 'Uzbekistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@xԦૣά࢝ЪշЄ॥׈Яࡾ˭ƴࣥ͏ǤěڢଅѺ۽ӥܕ́Ɛхॅ[ᶾᓘӺƾïದ׻یͅߤݵঢŪ෸à৔ؗÙࡅЦMǢۍ੬ɲЉ̺Lπ׺૎הӖƺʠĉ۵խئ́ײȾ়ѷ੽؁ٕĊ΍uţɺǪ϶૱țˋաЋҫۭ ɓυؠȧǺصҿࡗهǰҳN'],
                    'encodeOffsets': [[
                            68116,
                            38260
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VEN',
                'properties': { 'name': 'Venezuela' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@yȣӱĭ˜ϡYѭυӥ͆ڙδÆȌ؈ʻ̒§َਸ਼΀řІ̎ˆ̞ןל_մҵ˧ݮQ࣌ĔӖϕٞĻҼʾXɄਨ¼৖\\܉ʛ˼Їڦ×ِЯƆڧѬn͢ȣڕӱó̫˾̷ȽƽԫƉjϱɫɱّ֪Őʁ̭͍ऱ̽׿Žʏȣڛɀثņƿýϔɑ֝ŜՉ܆ï°ǭ׷ʅĭΣΉƏسȝǋʱٷÅҧѼʯ࠺ɟ̧̌ȄюмȊʅʠǛ֒à׼Ȉ˰ƲҎ̓Ơӏĩ؁®ͻęסܢӥńઉăȧ̊ȷêǬĴ̶áͺȃȂŅϮѡÈɸӮĺ׶ʔ̸͘ʌɈрդƖ'],
                    'encodeOffsets': [[
                            -73043,
                            12059
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VNM',
                'properties': { 'name': 'Vietnam' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@૭ܗ۫ߍȁ׍٠ࢭ޺ળނԱԞګϪ།ŕ๓۫փ१եۇ۫਷ޱ̧ՠʀ֬دӌܬ͸ࢦÔσԚප٨ļ৖ț֖ƶࡀɃצٍאՋ݌ۥ঴৓Ԋʊ̠՞ɘ͙ܺਙPϕކӭڐҊȴڢIࠈĬܒ҄К̿ސƵƃӛАͿࡎɓ'],
                    'encodeOffsets': [[
                            110644,
                            22070
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VUT',
                'properties': { 'name': 'Vanuatu' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ˣō˭ςɤՆӗ'],
                        ['@@ƌڱɥŀǩ­ťɴi٢Дʵ']
                    ],
                    'encodeOffsets': [
                        [[
                                171874,
                                -16861
                            ]],
                        [[
                                171119,
                                -15292
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PSE',
                'properties': { 'name': 'West Bank' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ԣŭʙЃŕɜɌŚɁĦǬ̤֔ś'],
                    'encodeOffsets': [[
                            36399,
                            33172
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'YEM',
                'properties': { 'name': 'Yemen' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@؉ɥǋύo˹࠷Οഇϻݩףυ±ʥºӭΑ՗ǉ۷©ɃµǿɛəÕŻɇеlˍœ׉¨ɓӬzҠƍʜǑتʋΊǚ¤đϨĸǊξςˌđΠɞЮΊɓɬúॺnƸċ߼č͐¨ɂ˫ϺƖ׼ࢦ޸Ϛᝒ͒ڀ൳˞ח'],
                    'encodeOffsets': [[
                            54384,
                            17051
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZAF',
                'properties': { 'name': 'South Africa' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@ǏŧΣяɻћӇ׻ोࢁףԋًϣ࢛͙ѓ«ŇɷԛŰеǅ࣫ǊԙĹΏ¬ࡿͩܓƃԱͅϡoΣ̚˳fαϒśŏɦLӰ˙֞˔ƴs٤ս޼х܈AF׽તДдͪɯƘΫϘÓՈǃҌÖݤіB᷌ɨűӾߙûԟȈ̏׼ĒрϒЊʨȶДЦȚΠķВɽۂ£՞ȜĐʾƨДҚäʨ͂˪֔ݮغஒؤ΂UОƛ˲Ķ҂ċД஁ɔׯƫऩî̟чƶʏÑāʓɯ̿T̃ԆҕӮĜǢώْQȿؑıۥɑϛֵщ',
                        '@@νʶϻǟҕ҃͡Տـ٧̜ČƺˎҴƀƜ˜ʴФ̅ʪ'
                    ],
                    'encodeOffsets': [
                        [
                            32278,
                            -29959
                        ],
                        [
                            29674,
                            -29650
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZMB',
                'properties': { 'name': 'Zambia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ІϏɊ܋ƝɩǙڻǈۡ˃̇ʭޭѶɓᢇۗĂׯٍřӍͯĹ̛̅ßܵۓҭխ˳o˗ĬऱĠƯÚOêͧȎկ¶ۋȑչԾ֣یᦶშYí̂Ű̀ƧЀĪТėʺ̂q¶ʽϾrՖûˬϡڨŝԤˆȌѯ٠ş̴ΧΈҥ٠Që࣠ɱƳח͞ɧƬļࡈƬসȉψʈ՚ɤĶ଀ƚͦđΘɇͰƗՖƗӊʧ'],
                    'encodeOffsets': [[
                            33546,
                            -9452
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZWE',
                'properties': { 'name': 'Zimbabwe' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ҁČ˱ĵНƜ΁VՙϞٯźʙՒC̒έĞ्ई˃ӢǛƮ͓ڤलğ˘ī˴pҮծܶ۔̜àĺ̆ӎͰَŚÆ̻۬hϴǯǺȻАÓѦˑF੟Ǐ׋عƊʝħӵŵùɛ؅ࢫ॓'],
                    'encodeOffsets': [[
                            31941,
                            -22785
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xiang_gang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [{
                'type': 'Feature',
                'id': '8100',
                'properties': {
                    'name': '香港',
                    'cp': [
                        114.2784,
                        22.3057
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@}ScTʟ@cWuJÁ]l¦RLj¼BĄà H@TOHCTDDDHDNAT@PEHDDNJLX@BABALHFF@DKHADBBLDHHFBLEJB@GDBBFBADDB@@KFAFBBJJA@BB@@FFDDADFF@FADDDBJC@AFBD@@DDD@DAA@D@DB@DHHBFJBBFEHDFAN@DGDC@DLCBDDCFDlAFBFCBEF@BC@GDAB@FD@DZJX´HĐMja@Ý`p_PCZ@lLnRGSDMFK|a\\Y}­§Mën'],
                    'encodeOffsets': [[
                            117078,
                            22678
                        ]]
                }
            }],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xin_jiang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6528',
                'properties': {
                    'name': '巴音郭楞蒙古自治州',
                    'cp': [
                        88.1653,
                        39.6002
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ÈÒĊanwŎVȮ¦ͪŃĢÜōȂçČéƐżLɆóĊĊaʊŁ±¯²Um»ˌmÈ»VʠţWÑÅ¯ǓéôƑƒğÆīŎī@Ƿwô˺LÞ¯ƨVǪÑƒĢȘV°wĢôk°¯ƒ»΀@Ȃ»ĸǔ@΀͔ôôLɆó̐ÝɜLɲōͪƨóŤK@ī@IU܃ÛmȻţǩÝ˹ÛǉťǓǫō@Ɲ²¯VçōKͿŁΗÇţ»ƽɅƑLÓŏÅÅɱV@ÝĊU¯ÑĊĭÞLÞŎJ±̃XȣˌōlUÈ¯ŎKÆƅ°XÑÜ±nŗġV¯óaUƧUōŁÑ±çɲ¥lĉkğ°k¥nğţL¯ÝÝUƽĬ΁lķ°@ōXÿÝ¯V»ŹLʉÞɱŤĉó°ÝJ¦ÝKÝ£ţÜÈĉ@xǩUċƑ@ky͓¹`U²ĉVġ»ğa¯¥ť@ĉó@ŻÛÛJw¯nó¯ġWƽʩķÝɛwĉĕÝ¼ȭÞķō@ó£Å΀Ƒ¯ôȯÞ¯ȰÆōèĉXÇ¼ó@ÝnºĸÞVƜĸȚUʶõˀĵĖɱŎÝĖVࢰӒѢ°˘nϚVˌÈmɼĵŦW¤öʊõʔ@°ÈXVènŎȁb¯ǫĉ±Èğ`ġwōÔğ»mVVÝ¥ó@ĸķô@bXĶmV²²`Þ_ɴbͪÈ°ÞWĸÈŌmÞkɲÈUÆ»n¼ǬVķĸźô¯°n¦ɄÇÈ'],
                    'encodeOffsets': [[
                            86986,
                            44534
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6532',
                'properties': {
                    'name': '和田地区',
                    'cp': [
                        81.167,
                        36.9855
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨ¥èź٨ΘƑᩄbUࢯÞĕɲōĶĕöʿVʵķșUƛÝķm¹Þô@È»ĊWŎçÅ°ȯȰÝ°óƒÆͿĉ»̽çnmɱĵƧºóUƽ@±wóL¯°̻L±Æ¯Vƴķb¯VÇ¥ğ²Ǖbk¥ÇKlÅɱġ@ÑóK@ÇaÝXğţxĉČǫķê¯K@ÑaŹƑK¼¯VóaónġwóÞéUġbóĉğÇl¹aUóğKWVÅ¯nÇŋƑķnʇ»óxĉwçÇ°Åw°ċXób±kÈÇJm²ţx@ÒÝŦÇºnó¼n°ÇbUÒ±¼XĸĠłƽXmwĉºzÈÜmnxmx²ĖmÒbnƧêUºĊêÆVóĖóUĉ¼ÅĬƑ°ɆƆŻŚlłÞL¼nĠ¼@ÞÞź@ŎÞ°VɄɴжϼِ͈Ŏ'],
                    'encodeOffsets': [[
                            81293,
                            39764
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6522',
                'properties': {
                    'name': '哈密地区',
                    'cp': [
                        93.7793,
                        42.9236
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WnŐÆĶLĢ¦ţºźlxÅĸƽŚɄĮè@ô²ÞUĔƐńV°¯ĸX¦Ɛm̐bƒ»Ɇa΀ĢƐLˤȘÑnІǉĸÿn¯ĶaŎ¯ĢĕȘ¯°΂la¯¥ǕǔwˤӱlťО̻nŻmɃĕċţUw°WUóƨÅţķ°ýV±óÅǓéʉ¯ƽŁéōǖȁÝƏůǕw˹ǫȗǓƧǕVýé@ĬţLƧôͩɱŎɛK̏ÞɅôóK@²@°ōŘ¼lŦ¯ŰóƜÛlV¼ķ¼°kȰŰĠǬŚÝŎmĖ`@ÇÜn'],
                    'encodeOffsets': [[
                            93387,
                            44539
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6529',
                'properties': {
                    'name': '阿克苏地区',
                    'cp': [
                        82.9797,
                        41.0229
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@VÆxˌŎÞŎ°nȂÒ°²VĊ¯VğƾˍǬƨÞÞKÈÞĊVźôɆÞĢèŌôWČ²ŤVÞĸʶbl¯ôn_VÆĸlmÞnVź_ĸ¼ȮmǖéĸW°°ĸJkʠ¼Æw°¤ÈlxɆzČºĶI²ÆǔU°ô@Þ¦UnUĠ¼ŎÓĢxĠ_²ÇĊǬ°ȂamōçUÇW@¯öʓõʉX£ĶťnɻÇUˋmϙ¯˗ӑѡᩃaΗƒɜ°xWƴUxɃÒˣ¤ɅwğʉōóÝŹ±°ȗ@¯Æƒ²¼',
                        '@@ōгwȁ¥Ƨ°ŹÑķV¼ÞêĊ»lĵm¦ÅW@ĀôÈźaɜxÈbÞÆĶIОŘnIÇŃÛÝĊÑĠƏ'
                    ],
                    'encodeOffsets': [
                        [
                            80022,
                            41294
                        ],
                        [
                            83914,
                            41474
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6543',
                'properties': {
                    'name': '阿勒泰地区',
                    'cp': [
                        88.2971,
                        47.0929
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɲˣĊIÈ¥ÅU±Ċýkō°ĉƽó»ĶƽXóʵʵȯƑÅȁɅ¯ĉ@ÇሗK֛@@ˤV֜ʵрƒǬVĸƑŎ@ƆϯÑóķ@ʇ»ķ¦έmlÈĸĊX¼WźÛÞÝѸĢČþĀĊôάVö¼ĊUƨ°°èŎČUÜÆóôVôô²êȘlˌç°`n²ǬĊaÛ°±kğmm»@°ÝɆÛÅÇVaÝVm͔ğôÝÈb@n¯ÜUĢÑĊ@źīżWŤÈǖWôŁÆI²ÓƨL@ĊXmmÑÆ»ȰÑkĶō@ý°m¯'],
                    'encodeOffsets': [[
                            92656,
                            48460
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6531',
                'properties': {
                    'name': '喀什地区',
                    'cp': [
                        77.168,
                        37.8534
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@Č@°ĠôÓô@Ŏĉ@Ƴĸ@Ť£ĢlVôWVóřXĉŤêÞ@ƐÒĢÑlèÈV@ĠIk°ÆŘ@ÈÈĀ@ǶťÒğ@@ÒĉlŻ_@ƧĖÅĬōÆ@bźÞnƒlVÝĬWÆ¼ʇÝÅ@ÇÅÈwWóĉ±ğzĬČƨÆÝIĉÝ¯bÇÑĉ¯ʈV°xUŰĊ¤ƪ_ôÓɚI@lȚXȮŎlɴȘ՘¦ɲÆʈ_ɴźôÞʊŎĠɆxˤ£ɄÑVwXƳ¯wɛŹ٧çƧ¦ōُ͇еϻɃɳUÝ¯@ōÝŹ@Ý»mğ»ÝKkŁżřɅƅƒ¯ÆīĊ»ôVôĕÅUĉéV¹ƨémanÑ±ĕnwmwnÇÛyĉ¹ŹlŏkĵèķmōÞġKñÔċKÅèĉzômxȗÿƿI@þÅČÝKÝ°@¼ÈVº@ÅĢÆUċłnÝÆǕČĵJm£ÝJ¦@ĊxV°ƏLċ¼ǩ@m@ÅĢómÇÆğ¹ÇÆĖÞKxwô¦ÆÑÆL²ÆƾU±ŚÅŻĖ@ĬŤÈñ@ǔÇxÈÇƒ',
                        '@@VÇţ°ğUĠ¯mk¯ó¥ķIġÿƏbĉa±ÒĸĀlKU_m»nwm@ÈŤ¦ĉbÞ°±Þżł̦°ĢŁVé'
                    ],
                    'encodeOffsets': [
                        [
                            76624,
                            39196
                        ],
                        [
                            81507,
                            40877
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6542',
                'properties': {
                    'name': '塔城地区',
                    'cp': [
                        86.6272,
                        45.8514
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@ήnĸ¥ʈ¼ĸ@ôϰÒ@ƅƒōUķƑǫʶпU֛܃LګK@΋ĸ@Æ£ÞġÅĠċLVÝ»@Å»Ýnm¯»nŻĊ@nķŃ@¯ómóÛÝǟ¯aÝóȭ¥ōUmxĉbÇÑ@bUº¯X¯ÆƧbVÒĉnǕw¯°ƑVÇ@kx±UɱnÅK¯ƒĠǠU°ɜL@°xnĬĀŋŎÇLğϱÞέƜkôÅĀǕłĸĊŤUŰĢ°¦ȂϰÜɨ°x@°żǠÆƈČVĠ»ČL°ÇbĊÑ̐óÞlĶwÞɆVÞwǬxǪţÈ¼ÜLŐĶˢ@',
                        '@@óKĵĀV͈ĉłƾǊÆŤzXl°ÆL²¼źôÈĢǔ¦lô°ɜÞʊĠğÅm»ʵƳƑʝȗīV¥¯ĉ°Ñ@ŃÅI»ĉmğnaċƨbVğwġ¯@UōaĉÝJğÑÆŎkŎÞĀlź¦'
                    ],
                    'encodeOffsets': [
                        [
                            87593,
                            48184
                        ],
                        [
                            86884,
                            45760
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6523',
                'properties': {
                    'name': '昌吉回族自治州',
                    'cp': [
                        89.6814,
                        44.4507
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@መL@È°ĊȂɆƒÆĊ£ťôWÓɆbĢÅŎÆ¦ČÑW¥°ķU¯ƏŃVē±Ý@óçĭɃƾřÆķkwŹŤ¹ġ¥ĵKŏÅXmˍщwǓ¤Ƒ@wóōVķ£ɱġôÛa±ÒȁóèţIVƽ¼k¤ó¹ġJmx»ÝU²@ÅÆĸǫŎĊmŎǬ՘'],
                        ['@@Þô°bÞǠôÜôn@°ĸńǶkł¼UÞKğČÆÝĢÅ¤ķ@@ΌڬL܄K@ˣȂ˭lĉÅW¥ĵVÆý@ŃÞēUŃȗƅ@ŹƩǕĉ»k»ÇVğóřXŻKƏċêȁèÛŎġͩń']
                    ],
                    'encodeOffsets': [
                        [[
                                90113,
                                46080
                            ]],
                        [[
                                87638,
                                44579
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6530',
                'properties': {
                    'name': '克孜勒苏柯尔克孜自治州',
                    'cp': [
                        74.6301,
                        39.5233
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ˎǫĠƽ°UUĉ¯±ȁÑm¯ÝōˋōwUÅ±»ÅƑ°Ș@²¯ɳʇ`ɱÅ¥՗ɳȗōkȭșW@kəJóÔƩ`ĉ£Vů¯wU°ʇĊÈÒ°aĊÞÞJÅċƧīĠyĊ²XôÇxÈÆÆ@ÞʈÅ»XÞīUƑkmŹÝ@aŎÅÆīƨĕ@ż`Ċk@ÑĠ@ŦÑ@ǵÇÿ@ÇÅŗl¯ğJ@ÇUkçġÒƏÑÝ@ţéWĊôŚUóXUġkţ¤ķ@@ƴōĊó@óÔğ¯ċ@@Ò¤kôˣŰ͓k»KX¯ċwƧôğɐÒôIVÆ¯UķǬķn¼ôb°ÒȰVVÈÞ°ĸó¤V¼°V°²êlĢÒUƨ¦ôȰƴĊVV¼ǖIċĊÞɜénČW˸ǸařÈw±īçĸ¤ĊôwĸUĢ¦éǖĬĀô¼lÞkÒ°x°ƆÞxÆV²ǔ»b°wÞȘ¥°nŎV@°ʠèŰȂb'],
                    'encodeOffsets': [[
                            80269,
                            42396
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6521',
                'properties': {
                    'name': '吐鲁番地区',
                    'cp': [
                        89.6375,
                        42.4127
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôKĉǪa²¼lÜô@ʠê°ĬôȂ²ÑÜbĢóɲĸ¤ŎUô@xƒǔ£ъxˎmÈÛ@_nĕÞōřǫğůlȯ¯ĸ»U»Ükôƛ°ůkť»Ŏŗ@¯@±͓óͿǓ@ķȁ¼Ϳ@Ƒ¼¯°ólġ¯xȗUġƑǩÒƧUÝ°˹Kóx@ǸōĬÅĬƑĠóƒǔêÆ°XÒʟŤUÇ¼ˋnn¼±V²°ȂUŌÝbʟǔɅô@żǬaҎÈ'],
                    'encodeOffsets': [[
                            90248,
                            44371
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6540',
                'properties': {
                    'name': '伊犁哈萨克自治州',
                    'cp': [
                        82.5513,
                        43.5498
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ĉÆŘȁ̐mÞ¯ĀX°±¼@ƾ¯ƴ°ŎÝþŋ¦WÜÞbȂĉźUÇmwVUȂóô@ȰÝ΀nÆJnƾʠŌLČóǪ¯¥ǔaǖŌaôÝĢLxÆLɲm²VlwÈ@Uƒ°¯ǖxĊmUÑƨa°Å°WV¹aÇɃÈm¥°¯ŹóĸķǫUm»Å¼ÇVɱlÝŋnķÇÝX¯ͩÇɳaÝ`±_U±ĵnWa@ĸóķ¯ǓV±ÅĵJċ¹ɅykwÇ¯£Åxʟ»lķI¯X¯ķêǕȭnķ»Ź`±kÞ@Ýô@Þ°xŤŎIƨÆUxō¯²ǔĬǬlUŚ'],
                        ['@@ÞĀlź¦¯ĸŤKÞċƨbVğwġ¯@ţƽJ']
                    ],
                    'encodeOffsets': [
                        [[
                                82722,
                                44337
                            ]],
                        [[
                                86817,
                                45456
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6527',
                'properties': {
                    'name': '博尔塔拉蒙古自治州',
                    'cp': [
                        81.8481,
                        44.6979
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ήƛϲÝĠÈKŌōÿmīw@¯ɛKV¯ğǟ°ƑwġKóÞŋbǕǓb¦ǩ°ċôŋKʟƽmÅImͿȯÞó@ȁôUVnxÈŹVȁĊÝabŻ£¯°lóxȂŤĸkĊÞyĊêĊmĢxVƨÈĠXΘÆĠÔźɆţ°LXƾŤŤb'],
                    'encodeOffsets': [[
                            84555,
                            46311
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6501',
                'properties': {
                    'name': '乌鲁木齐市',
                    'cp': [
                        87.9236,
                        43.5883
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WôŚUĠÈl¼Ċ¼ƪǖ@źȘƆ@ýlÜXVŘÞ¦V¼kĖóÒèkĊȁˮ֜@ǫ՗nōĉǬōķÆÅ@±ÞV¼nwĢIôºl£ƾ»UŤJôçó¯īʟéó@kÛ±»ǩbĊóLҍÇǫb@ŻɆóʠǓaŋÞȁVʉłĉbĉɅô'],
                    'encodeOffsets': [[
                            88887,
                            44146
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6502',
                'properties': {
                    'name': '克拉玛依市',
                    'cp': [
                        85.2869,
                        45.5054
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɜÞʊĊýVaÅm»ʵƳƑʝȗīV¥¯ĉ°Ñ@ŃÅI»ĉmğnaÝţL°ķóKĵĀV͈ĉłƾǊÆŤzXl°ÆL²¼źôÈĢǔ¦lô°'],
                        ['@@ƾIŤ@UUwōaĉÝJğÑÆŎkŎ']
                    ],
                    'encodeOffsets': [
                        [[
                                87424,
                                47245
                            ]],
                        [[
                                86817,
                                45456
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '659002',
                'properties': {
                    'name': '阿拉尔市',
                    'cp': [
                        81.2769,
                        40.6549
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nIÇŃÛÝĊÑĠƏōгwȁ¥Ƨ°ŹÑķV¼ÞêĊ»lĵm¦ÅW@ĀôÈźaɜxÈbÞÆĶIОŘ'],
                    'encodeOffsets': [[
                            83824,
                            41929
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659003',
                'properties': {
                    'name': '图木舒克市',
                    'cp': [
                        79.1345,
                        39.8749
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VéVÇţ°ğUĠ¯mk¯ó¥ķIġÿƏbĉa±ÒĸĀlKU_m»nwm@ÈŤ¦ĉbÞ°±Þżł̦°ĢŁ'],
                    'encodeOffsets': [[
                            81496,
                            40962
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659004',
                'properties': {
                    'name': '五家渠市',
                    'cp': [
                        87.5391,
                        44.3024
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@çôÑlĕU»¥ÝUŗWkÛ@þVńÝĔ@ńÅþĶUX¦Æ'],
                    'encodeOffsets': [[
                            89674,
                            45636
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659001',
                'properties': {
                    'name': '石河子市',
                    'cp': [
                        86.0229,
                        44.2914
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lŁǵmĉ@mż¼n°ÞmÆ¼@'],
                    'encodeOffsets': [[
                            88178,
                            45529
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xi_zang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5424',
                'properties': {
                    'name': '那曲地区',
                    'cp': [
                        88.1982,
                        33.3215
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨʔĸbÜºÞwnxźbÞ°ô@ĶĸIÈ¼ĊJŎÈôUÝƒ¤ǔLÞŎ@ĢȘblôLÇźçÈ¤ôL¥ÞIÞ¯ĶxʊťƨƿÑĉXVķŦ¯ȂKÇǕÑ¯IU£¯Óƿ£VĕÅÞÿÆwƑ£ǖxÞĕ±ÇÝaUÑÈU¯UōÈÝwWŁĵ±ÝóĢÿ°IÞ±mÅĢ¯mÿ¥°UnÑŤĢĕĶwǬŻͪwŎ¼źÇĢĠĕˎŁ°óƨ¼Èam@¥°wǔǖ°ƨÇŤġƨŎŃôbÈÛŎĊ°@Ġw²ÑÞJÆÆb²°êĊUÞlÈ²VÈKĊÒĸĉ»ÅôťUÅÇk¯@ÇÑklÇÅlĢVÑó@°@ÛĸV¯ÇĊn¯Uĕƽ¯m¯bÈ@Ò°Ĭbĵ¼kxķýÇJk£ÝaUÑÅóĶǟkÓʉnĉÝ¼Ƒó»Þmn£mČ¯@ȮÿV¯ĸk@Ýów»ğġ±ǓLōV¼Əèķĉè±b@ÒţUÑóakl£Ó@¯L@ÇlUóȁ¯aġÈÅĕÝLķ¯Ė¯@WĬxÒÈnW°ţôU²ǓÓġ²V°¯ôǔÝLċk»Ý»Ý¯ÞVwÛÝÇōͩÈĉċ»ĉm¯£W¥ţKkóġƏW@¯±kōÈb@ÒÇaÆ¯akóÛÇ¦Ýa¯Ýĉ@Ç»ÛmǓxķƛ¯lVĀÅÞġbÇJUÅVĖƑWzō»ōWn@è¯ÞóVkwƩnkźÇÞÒÞ¯ýğÇUxÆÈnè±bĉÝ»ÈŃwwÞ@m»ÈV@ýÇ°ķxaÝ¯Xċ¥ÈóW@ôkxlnxVÈóĊkŤġ¼@°¯ŰƑL̻Ű±ŎÝVÞVÇÞÅÇakƞ@èğŎĸżƾ°ÒLÞôĠKȰĖźVÈÒĠ¤VôUÈþťL@ôǬÞlÜÈnÇÒUŚ@ĊƨW°°X@ČÇþƴĉÒķ¦@ĢôWĀôłUÞĢǬź°¼@ôV°bUÆnzm¤ƽĸÈ'],
                    'encodeOffsets': [[
                            88133,
                            36721
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5425',
                'properties': {
                    'name': '阿里地区',
                    'cp': [
                        82.3645,
                        32.7667
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Çƾķn£myVÅaU¯ó@¯»ŹġǫVÝóŁXÿġó@ĸ¥ĊÑƳÈý@ċW¯X¯ĉƧ@VřÈÑÇmkÛǫÝ@óŦKÇýVUó£ğÇÑŹUȯĕğLÝóK¯ÑƽķŻĠō@çlƝÈbÆÈÝUÝÞU²ō̼ůƒK°ů@¯UK±ĊƧbōÇmçÈġóÅóbźó¥kīÆ¯ólçKôĵUÅVŃķ¥nÅŏm¯¹Å»@ÑÇóxÝkʇȤU¤ķb@ƒ¯ĊÇx¯ĸĉKm°Āk¦lKnĬȀƾÛ¦WÆÅmǊĉ°ōUţ¤UŎ°ŎKÞłÆǓ¦Þř¯bmUÝl¯Umğl¯£șwÅǫaÝnĉĶk@¯Kō»ĉnaÞ»ťnkmlĸ¥UÅŻkÑťĉVôó°LôīĠUÿĉǕÅz±K¤²ō¤¯Ė¯UÝ¥VĵóÈťÝwķÈÑk¤óWýĵĕVĠVóǓķ°k±VU±ţ¦UǟÝÅJVÑ¥XUċUÅlÛƆǕÆȗƆ¯wŏÞÅ@ĉlÝóÒnUôÅlxólÝôÛ±LÛôÝL@ġ¯X¯ÇUÅ¼óaó¤¼XÒġŎóLk¦ôÅ¼ĸĠ¼KġƆô¦ÆƑÔĉĶ¯ImÒ°¦n°¯ÞlÝČnƒÒKĠÞĕklýƾťôIĖŤÒnƜm¼¯lnżóÞ@Ůó¦ôƽĖċŚn°Ý°ôÈUƜblÞó@ǖô°UÈƆ°XþôôlѢ²Ėm¦°@¤XĊblÜzkºƒĖmXŎWVóÞn°lĠxȚa°»żLźb@Æ°XĠÝȚxĊĕŤaȚ°È@@èŤ¦Ü¼WÞkÈ@V°lŤkŎ±²¦ƐUǉ°aÈÑŎbĢŎbÆ¥ÞIȘlôVÈUbkɲĶnmnXb̼òƾĖŎ@ĢȂÑôÓĠĖʊĊÔ'],
                    'encodeOffsets': [[
                            88133,
                            36721
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5423',
                'properties': {
                    'name': '日喀则地区',
                    'cp': [
                        86.2427,
                        29.5093
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĶĖXþôl£ÒĸÇÞxÇŦôUĶÞ¦°V°ĕŎ£±£²LÆyĊǖĀğVóĬ¯KóôUĊŦlÒżVÆķ¦klnŦmÝ¼bĊmŎ¼L@°lĊĵÞmǬbÆȚx°¤Ġkn°VÞkVn°aŚÝǔ¥ÅÝŁōL¯ōVŤ£ŎVĊ¯nǉÆXÅÜ¥ǿƽmīLkl¥ÿn¯ĊL°ķÈw°ĉ@ƑĸaV£ʈȣÞlôwÈ@Ò¼Æ°ºŐnmÆĸ¦UńÆVóĶLèôkÅ°lĬ¦ŹôôaÆôÇĢnèŎÈƨaĉ²VLĢ»lţôĉUÇwkmlw@óôXÇČ¦°WÞbwĸÈ¯@þÇUn¼Ý@xxÇńÞ¼Ċ²amçÅÇVwĠÈþ°ÝÑÈÝlŹƪmlxôU°Ý@çmXŎŎ¼yƒXĕÆUVÈIĢaÆÝUÿ°kĸƜǔwnÜÈ¼Ċ@Þ°ÞbÈ¥Üôl°bÅÈb@ÑaÇ¯UU¯Vġ»¯aV¯Ç°ÅmnÑŤçǬVǬ±ĉ¯¥Vĕ¯Ýk£ōw@±ġÛ°ÇVÑ@Ûa@ČLƳÇa¯¤ÝIĵ¼U¥ƿōķÅţŻókÝóĕ¥¯U»Æ£X¯ġŃÛkÝ°V°ó¼¯èWôÞĖȎkĀƧĀówm¥¯JÅ¹ÝJÝōVVÅaÝƑ@ğŭÇ¯_ĵVnxÅónĵxÇĖĉVÝÈğVÒó¯±Żĉ£ķÆÅLǈĉýţÛ¯VnV¤ÝÈ@°ÅÞÝ¤ŰğŁm¦ÝxóK¥ɱÈUĠôêVôÛ¼ÇWÝçĵaō¦óĖƧlÇĢƑnŎÇV¼¼ºÛ@m¦ƽĉmm¯ÝKÛç¯bŏłĬb¼ÅLmxť°ÅUÝXkÝmĉ¦W¯KÒknÝaVÝè¯KɅńÝKnÞ¯¼'],
                    'encodeOffsets': [[
                            84117,
                            30927
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5426',
                'properties': {
                    'name': '林芝地区',
                    'cp': [
                        95.4602,
                        29.1138
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VÈłVôÈk@°K@Ôk¤lôbVÒŤ@Ñ²açĸĊƐçU»ŎǔKĢ²Ġ¼ôx@ÞlƨĬUl¯ÈLVÞJ°ÜnʊwÜbXêVÞ¯°anaU°wÆ¼ɴÑWÑ°mÈýÈam¥Þ£Ť@¥ôblÞĢź¥ôxÈÅmÝĕÅV»ĉōŤōnó»ÈīķIUĠÑ°ġĸLÞ¯VÒÆ@Āb¼WôÈ@V¼ôóŤKÈÑU»wVǫżnWÒÈx¼lŦ£ĊōŤx²¯@ÆU¯çÆ@¤°£é°k°lůÈó@¯ŤÇÈĉkkÿó¥ÝXķÑÜ@ÒóŚÝ¯°ĉówÇ±¦ÅJUÒĉĀķw¯°mĖ¯±akxÝÅn»lÑK@¯lU¯UVÑ¯óĊ¯mōğVǓƅÞWÝÈÛ@ƿô¯ÜġzÅþ¯ólmôʇġĊÅUͿřŏȁˋŁóÇˡōƧÇbw°Ķôk¦ÒnUþġÒÔkǔķèó@²@ŘōńĵyzġaÝ¤ÅI¤Ƀť¦ğÑ¯¤ķbó¯ó±U²°¤ČÜVnÈÆŚŎ°ôĢþÆzèVĀÇĀÇXŹÑ¯¤ówċķk¦łUÒġzÇ@ÆÝx@²Þ@Æ¤Uô¦U°xU'],
                    'encodeOffsets': [[
                            94737,
                            30809
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5421',
                'properties': {
                    'name': '昌都地区',
                    'cp': [
                        97.0203,
                        30.7068
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VĖm°ĉÈU°ķÜ¯@@ôUÒġkÆkÈlÒ@Èl°ÈVÆóŦÆ¼aÅĢɄwnōw@¥Ŏ¦°ŹÞmV°wnÿwwÝw@¯mÞŗ°wĠĸkÞğlĔ²¦°@ĕĸwVóal@nĢÇĊn°@¦źUXçǔůĸVÆKÈÝĠ²ÅĔô@lÈ_mzǖlaU¼ôwV°¯¦ĬÈal@ČÇ¼nIxô»ɜ@ƨ¥ɆŁŃǪȁkƛƨȍʊȡóĭ@ÈÇVůÞĸƅmēƨťÅÈʉVǵ°ġVŭÅɧ°ÿnɛ£mķ²ŃóÑUĉ°mÇ»¯@mxUĀ¯èţ°ȁÝçġU¯ÆÇţÈ@°ÇôŰ¯k¯lê¯¤£Å@èV°Å@±°ţwĉŎť¤k»ÇwXÑŻmUǬxV¼ÇÒţLóôU»Ç@Xó»a@ÿÅUÑÝ°ķK¯ĢğÒVĸJÇĬ¼môţŎĊŎU¼ÆĖnÞÇÆówŹ¦ġkÝóa¦ţ@Ý¤n¦ÇbÇþ¯nXÒɳÒÅ»¯xVmbb¯Ý°UWéÛaxʉÛm¯ÝIUÇKk°VƧīķU°ȭĀ@ċ°nm¤Ýnô¼ƒÞ»ĊʊmlÔĵǠÆôVÒÞbl¤ÈIĸþlw»Ķa¯ī@ÑÇ°anƾ°'],
                    'encodeOffsets': [[
                            97302,
                            31917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5422',
                'properties': {
                    'name': '山南地区',
                    'cp': [
                        92.2083,
                        28.3392
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°ÞUĖ°¦²ĊôÇÜLǖĀɜȘŰÞLĸźêÞ@UÜUŤ°ɞ¯Ü°WŦĀmŎ¦ĢyVÑŁl¥Čĸôx°£źÒWÈÿÈUÿçÅyýóġō¯řÅmÇÛUċ¯£V±²°ôôĸa°£ĠÒŦ¥Ʉ£ÆJÞ£ĢbyĶzŎŃ@ŗ±ô@ĸçlǓÓĢÑVýmÑl¥ĵó¯̻̥ƛǫÝһÇƧĉyţ¼ҍēVĶĉŎ°ĸmÞVÝĸÒÛaċóŹĖèÈÈl¼k¤ÝX@`Þŏ¼Æō¼ÇçĉKUÝÝ£ğ¤@¦ġl¯Òġĉ¯ómóxÝÞğVƴċK@b@ÜUÒ¯ÈĢÜ@²xŎl¤'],
                    'encodeOffsets': [[
                            92363,
                            29672
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5401',
                'properties': {
                    'name': '拉萨市',
                    'cp': [
                        91.1865,
                        30.1465
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ŏ²l@°XĢƐlôŤLX¦°¤ĊnČ¼ÇĊŎͪÞÈÜxU°ÝÞÞ¼¼lČÞKǓ°óU¯Ģ±ǔÔV±ŤóX¯ÇmÑwXī°@°ĕĸÞKÆĖĢÇ°bȂÇŁUV¯wVó¥VÅ£Ý@@±ÞwÅÈ@¥nōťÿ¯XÛɝ°ţ¯ÛVVÝ@ŹéķÝKȗůɛǕÿÛKóÈǫǫUţèmÒn¯Æ°ÈU°b¼UĢV°°V'],
                    'encodeOffsets': [[
                            92059,
                            30696
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/yun_nan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5308',
                'properties': {
                    'name': '普洱市',
                    'cp': [
                        100.7446,
                        23.4229
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Uô²a@²²Ķ¥V°Ķ²bl¤kVxl@°Ś²@y@ô¦¯@xxVxUVbVÜm¼ŎĢmºXXWÆ@ĀmmXU°ÅÒm¼Þx°w@°XêĠ°»nV°Ul@k@V±ôī@£ČŃÆ£KÞý@¥k@ya@nWVUVwm£Jknm@wmknXX¥mUUlUnb¯°nkVInlIUw°nmk@@mlanXlanmk@wVWUw_@éĠanmUaÜ£mX¥¯@@óUmÝ¯¯ÞÝlKnxô£»»ĠJ°aVUÝÿV¥ÛbI@wmón¯yÛL@WkÅmÈ`IWa¯K@¯mUnmaXmbmak¯ĢÒÝm¯mV¯KÇb¯KÛWWX@aVknċLUWVkXóW@ka@ób¯Uwmb¥UUlaU¥U£maķKXkmÝ@kwmÑ¯k±ċbUUVakaġ¦kL@`a¯xmÅLUW@ċnÅUV°LkL@b°°@¤²nôôkl°kèÒÈzV¤ÈWôônV@¦@¼Ux'],
                    'encodeOffsets': [[
                            101903,
                            23637
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5325',
                'properties': {
                    'name': '红河哈尼族彝族自治州',
                    'cp': [
                        103.0408,
                        23.6041
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°°nÞôV@°@¦WnÛ¤Vbmnğb@ê`VxUX@xÆÞUnnWÞĸĢÈ@Çè@zÛÜWÅêl²KnV¯ĖĊx@bk@@°JÆ£Èblnnm°nlUkVUUwVmKnnVÞxVLX¥laX@@xl@VzÈVmk@b°ÈĸmV¦`WXbUbbX¼°x@aVVkn@lþnXUlVxŤÅyIUkaIŎĊ@lXx@bz@ô¥_V@ln@ôy@al_l`nmÈ»@kmXwWKU¯»aÅ@wmUÝKUaUUwW@w²»@kÆV£mm£VKkÑV@@»nw¥@kÆnllIVlnLVakalknJWmnaUaVÑVVÞn¥m@¯Uÿl@VçaXaV¯UyVLVk@nJlXLlkxlbla²Òl@nVJVkxKlkUaVķÝÑU@Åm¯@±Uó°ğńķĠmUÑ@Ç¯¯Å¼@nml@°¯¯`@w£@¯Çk@»nmċ¯U»I¯LÇĶÛn@bó°Uwm¯UmÇ¯aI@ykIVU¯bIğ¼¼ó¤mwkLÝÞ'],
                    'encodeOffsets': [[
                            104243,
                            23429
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5326',
                'properties': {
                    'name': '文山壮族苗族自治州',
                    'cp': [
                        104.8865,
                        23.5712
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@wô@²¯maUmôUÆx@XbÞInlVUVwJVaUK°¥xmÞXnlKlnna°@ĊČÆwUmnkl@°£nyn@VV@Vak@@kÞÝbmx°Vnw°klÞInĖÞVlKl@Xa°KlVU@JnxU@ÈĢbUKlm@ak_wanWUk°l»k@Wk@lwU_@UalóU¥ÇnkJW@mVXx±bK@nV±a@Åa£ÝK²WknamKknÇk¯aVV¯ĀUÒ¥I@mm¯¯xÅW@@`k@ó»UU¯lm£ÅWlĵw@mmwÅmWU@y±UxmwU¯U¥Ý¥¯£m@kÇVUV°VbklLwUlUImk@±ÑkbkalwkWKkmI@UlUKVzU°WbbUè@kVĀ°@nm¦ÝUUUÒVbmbXnmIkllbUbmKUkkJmkÅ@l¦mx@¼U@lÒULn¤nU¤Å@l±¼@xXxVVVbÞLVn@xÆb°¼V'],
                    'encodeOffsets': [[
                            106504,
                            25037
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5303',
                'properties': {
                    'name': '曲靖市',
                    'cp': [
                        103.9417,
                        25.7025
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@È¦lKÞĕUV¯Um¯ÇVUnVVUĉnĊÇƾLn°°ÈJÆw@lbÞa¦VXJ°¯W¯aÞJVkUa@lKnÅmWUk¯a¯»@m±@ÑkkbWWX_WÓU»_lkÑm@U»m@l@IWċn¯l@VanVUVUVwVxKÈVmUē@n@VÝÆLwVVwnVlmkUVÑÇ°ka@kÿÝaÞUl£ċĕX±±ĉa@UnVnalónk@wlUVmkÝJaW@ÅwóVVnnb±°@óxXLWxn@lÇ¼nmk_k`@bózm@kU@`¦ó@nW@ÜÅXWw@yb¦@ÒlnUb@xlÜk@²Ç@U¯bmy@kV@bb¦U`lLVx@bLl¼Þ¤@°VVÞU@WÞUbJ@nn@lnnmxUUUbK@ÇwklkUVWakn@lbU@@ULVxkKUn°¯Ò@¼km¦m@klȰ@lUl¦@Vl°wnnþĊUÆbUxbVĖU°annaVal@@b'],
                    'encodeOffsets': [[
                            106099,
                            27653
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5323',
                'properties': {
                    'name': '楚雄彝族自治州',
                    'cp': [
                        101.6016,
                        25.3619
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mÒXU`Wn@Xl±¦Uxnbl°knmKUxxVôUx°¼ôÒÈ°JlnÞKĠW°¦Vx²JVw_°¥@UV@@wnymknK¯I@²b°£V¥wUV¤nLkÆJÈwôô°l»Č¯ġVUU@@°ÝXl@U»°Å@U¯@w±¯VmUUlm@mÑnIVyUwmak£Vwm±@Çw@n@UxkwlÇnLmkÅ@±kka@kóJV¯Ç»U£lw¯Xalbl¥¯UX@aUaÈL@ÇVIVkaU¯mmakLWkUJ¯Umxn@kUx¯xmWÅīÝkkbŤbkxWmXwWk¯wKkLÅ¤ċń@¤óĬU²@@lk¯VmU¯¼@xV@k°l°kbU°nmVnU@°UVèÞÆbUÒÞnU¦V¼lô@Vl'],
                    'encodeOffsets': [[
                            103433,
                            26196
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5329',
                'properties': {
                    'name': '大理白族自治州',
                    'cp': [
                        99.9536,
                        25.6805
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lbKVIUa@²m@bxôÒÜxXLmbnl@K°¼kUôxôlV¦nJUÆnm@xÆwbXÆôôLUVwôK@wlmaVw@WknmIUmlnJla@_@kÝmKUaÑm¯Xw°aUaVl»²JVbÆJkôĶĀ²VVkmbVwUówVwnLlmk¯maVw²¥Wk@XmV_WnÑUk@kó»UV¥ÝmVÑÅaÝUçV@¯VUmn¯mVlak¯l¯U@@wğWé¯@¯xÝw¯¯Jċa¯U¥mLU¤bÞȤbÇLWUwmIUVW¼kb`UVb¯L±ĊÛkÿÝKkwKţêUĉþÈV¯ÞVbU°KVk²ÝmImV@kmUkVxm¯KXÈķJU¦V°ULWxL@môb@bkx±LnVUVLnkÜWnwlLÅƒmW@kkJU_VWĊÞ'],
                    'encodeOffsets': [[
                            101408,
                            26770
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5309',
                'properties': {
                    'name': '临沧市',
                    'cp': [
                        99.613,
                        24.0546
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@xĢl`²X°Vx@x°Þ°KXağUÑWbnIl`X²°bxl°V@xVxk¦mbl@xXVÆzX¤Æk°kx@lźêlaX»VUnJVxXÈKaÝȣaV£nKV¦°Čb°I°n»ÆÑV¯nWn@ÿXÅWWn¹ġōn»ÛUaUVUww@w°ó¥@z±@ř¯@kUwlk£±aĵ¯Uĵ¦±±@bó±VÝ@ó¤w¯I@mÅóm±X¯IólK@°UllbzkKlln@@ÔºUmVk²ôÒxŎUVóLbmÈnmbnlax@z@Æ¦k'],
                    'encodeOffsets': [[
                            101251,
                            24734
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5334',
                'properties': {
                    'name': '迪庆藏族自治州',
                    'cp': [
                        99.4592,
                        27.9327
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WXw@akk@yk°īX¥Uóķ¯w@n»UaVaUÛ¯mV¼kÞċô@n¯xÛÒmV¯Ô@x@kwmÅa@UaÝ¯VÅyVa@ÿn»ÝVmankmmÞÅô@n£±ğzÇmU¦VmnÜmbn@°nV@xmzÅ@mºV¦k°ln¤¼õôn@xkÆIUxU@Ť¦VmVkmkXW¤XzVx@Æx¼Þ¯b@lVĸÞVm¼Xm¦VÞ@Æ¹Vón¥ÆKnKX¯x@èĊÈ±łXaÆxnlV@UÛlȻkğV¥m²ǉmÅÞĕƒƛm°ÆmX¤mznÆV¦ÞVVb°bnÞWbn°l@VÈ@VĵĊ±@óInxÆw¥@£ÞW¯ĸ£UUKk±akkkbmWmÈķaÆÇUÈÆW@wmknmU¯'],
                    'encodeOffsets': [[
                            102702,
                            28401
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5306',
                'properties': {
                    'name': '昭通市',
                    'cp': [
                        104.0955,
                        27.6031
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mnK@wmUÅ¥móXǓŏmX@VmL@xţnk@mlUŻÒğŋ@L@mmLkm@bXÅW¼ka¯lÇŹ¯aÇ»ÝÝ_@m@@a@UklwUm@ak@bUmbmbV¯ĕUaVwÅaĉVmým¯xUk@k¥VUX¤VÈm`@ńÇÜ@ĀknĔkƞÆĠÞUVôƆÞI@UxÆ¦nl@ĊĊnxUÒ°¦Vb¯WUnWIml@xnUbô¤¼ÈxlI»KV@ÈÔJkUĖ±ÆVb@nVÜVUVLwĠlknĠ@nx°¥Æ²mUw@mmÅUl¯UÑÑUmLllIl±@VkwW@w°@U»kUóI°»ĢÑL`nUĠ²lmbôV@nJUxÆ¦X¦l@ŎUV@lVKVÅV£UaÞUnW@¯VU@ó'],
                    'encodeOffsets': [[
                            107787,
                            28244
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5301',
                'properties': {
                    'name': '昆明市',
                    'cp': [
                        102.9199,
                        25.4663
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@VkVUn²°@x°V@¯ÆV¼k@WÞ¯@@VVUĢċ°k¼VĊx¤Ōx°mVkÑÈL°x°X°VmĊLVxUĖ°bX¦VW@kȯlkn@¥ln@»°Ñ¯VmlLUwVK@V@ka@lmXbUlVlkÈx@LVaVVwnmm@km@mIVaÝ@XVUÝ¯U@Ý£k»K@aUwkKV_¥a@alU@nz°aVÈ@@±lÛk@wVakm@Ñ¥az@XxÆW@ÛX@m@y@aWw@kōĉJlbVJzţÆUwVkmWkým@UlU@b¯wVºUVUêĠXUaUbVĊUWXUmkKWnUUUVVVÝ@kk±¯Lk±WkXlVkl@wXbmLVUIVmk@Ubma@kkaVKUkmlXLWnJ¯ÒĊ°@zkºlLUŤn@@nô@lÆnmKkÈlxVw@@mÈx@n²Uxl¤nbVxUzmJÒn'],
                    'encodeOffsets': [[
                            104828,
                            25999
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5307',
                'properties': {
                    'name': '丽江市',
                    'cp': [
                        100.448,
                        26.955
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l@@w°ÓUnÜÑ°w@mČóÝlU»n°VÜUbVbm¼@°xôĸVW¦¯Ĭl@zll@bWxXaX@ÆĠÆaXwl@XaÆ¦n¼Jn@mnKW¯È»V¯°akVanXVwl@VyUĕVUbÈīlaUk°k¯l²VUkƛô@I@mVwĊaVakaÆbUVLaXIWKUwaWÑÅKUaVk°@Uw¯¥XğÝLkm¯IÇóÑ¯»anUl±UĵÿlóÅIaU±Ik¼UVb¯bWxn°ÒVbnLlÞ@@`kbmIkVnJmnXl@Uxbkn@xóLUxVKóóÅWaÅxw@nÅmVôXLlVU¤b¦m¼@ĀbUzUÆ°ÞVb@Æbnx'],
                    'encodeOffsets': [[
                            101937,
                            28227
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5328',
                'properties': {
                    'name': '西双版纳傣族自治州',
                    'cp': [
                        100.8984,
                        21.8628
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l²°nÒlxÞ@nWlLĸnbV¤V¦kbVV¦nax°Vôa@b@lôXlWUVXČKlmU@bWXXÜ°LÈa°LnU°ÞnÑġ°lnba¯¯KWó@kmK@UĉV@k°VV¹a@y_ċl_nÓlL@anI@óWl£VUlkĕlKVwU@kVam¯ÅL@bÝk@VnUbÇbÝwÅ@ċ¥¯lk¼ÅÒ°b@¦nlUn@ÇVmÆbWôU@ÝÅōm¯aUmkWWw@±n¯UèaL¯mLkwl@°mnÈÒ¯ów@VxĀU¤°Į°Xl'],
                    'encodeOffsets': [[
                            102376,
                            22579
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5305',
                'properties': {
                    'name': '保山市',
                    'cp': [
                        99.0637,
                        24.9884
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X°Il@¦È¼m¼ÞaÞÅlÈxV¼lVôÈÆlLÞ£ÈºlkUUw¯UĕVwĊ@n¦mlnVĸIWÇ°LnUwlVn@lnUnJÞl±U¯LVUa°ÝUÇĊýVŤéLlxÞLĀÜl²ĉ°KUaV_Źé@klw¯lÅW£ÅyUW@wknal¥Uw@wUk¯w¯aW±k_mJaXVÒĠWb¯L¯Ý@wwU¯±Wk_ġwwōKmb@¤bk°lĖôUJVnÅlťU¯°VbnbWxXmÞWUĀLyWzÛKmbUxVKknÝkVĀċ¤Ux@¯m@¦'],
                    'encodeOffsets': [[
                            100440,
                            25943
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5304',
                'properties': {
                    'name': '玉溪市',
                    'cp': [
                        101.9312,
                        23.8898
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lL°xXlWxXnlwaţlaÞlÆĬnX°wVwl@mnw°VVIXllKbnnV°lbUUJ@ÈÇKVb@bW°Vk¦kaWb°kxV¤È¼U°ôI@llbl²@@ó@mm@VţkKl¹@yĉ¯°ÑIXmWKnklVULlb@lnbVal@UnVJUnKWax@lkkUlW²XlK°l²@lÞUUUVVVXmlLVnXWVUĉVaVbWğVéUVU¹W»aVaaWX_U¥nÇķ¯@alUnÇUyk@@wW@kbW¦UKÝwUmmLUnVxUVVlk¯mmnmkÇaÅ¤¯I@l@@aĉw°ĕmUL±kÆéXÜÛ@yÈç@ÇġÝķXmmÝVÅlmnkbmWkb@nl@nm¯VxkJmUJml¯°makVVnV¦WWmnl@xmnlI¤nxUVUmX@b@zl@¦Ýþ'],
                    'encodeOffsets': [[
                            103703,
                            24874
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5333',
                'properties': {
                    'name': '怒江傈僳族自治州',
                    'cp': [
                        99.1516,
                        26.5594
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WyX£lWlnnUU¥@ţVVwJlÅ@wmöó»£kml¯U¥n¹Æ@ny@wmU@¯mnamÛnUV¥ÈnĠy²m¤@ÆónÝnmlnbÞU¥aV£kUKWómIU¥ókwVól»¯Lk@mnaWKÛwóÑw@a±n@VbUJLkaÝXĉUV`lI@lnXÆƑkKmxÛXmlUKVmU²Klw@aaó@nKXwVKU¯V¥mUnkm¥ĉ@UxVĖ°VxVklmÞkKWĀkVWnl°Lnm@°UxlV@nk¦JVÈ°VÒ@nX°@ÆlUômlnô²nxmłnVV¯x@Èm°XblVUl°@xkXU¤WXXWXÆmkÅJmÞw±bxUīkKmÅVUĖÝèVkx@lXlnk¤LkĖk¦xUL°¯Ė@LnK@b°xVI¥Ua°Ñ@»nm@¹KŎÞÈWln²n'],
                    'encodeOffsets': [[
                            101071,
                            28891
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5331',
                'properties': {
                    'name': '德宏傣族景颇族自治州',
                    'cp': [
                        98.1299,
                        24.5874
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@¥n@°@VwČ£ÿUlÞlmULVwnaÜLXyzKVÿXÝnWXwmaUa°¯VŦÆkUmVIókĕl¯a@£nama@¯m¯ó@óyţbġkÅm±ÛammVkLwU`Wk@VkUmÅlUUKmbkkUVUw¦ó°¼bn°ô¦lºz@x¯@U°nU¤ţU°VƆ@ÈmlnzÞl°¦ÆaxUxLkxWƒn@²ŰW@°ÈXl°Llx'],
                    'encodeOffsets': [[
                            100440,
                            25943
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/zhe_jiang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3311',
                'properties': {
                    'name': '丽水市',
                    'cp': [
                        119.5642,
                        28.1854
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VbVl@XnUXKV@¦nxlUXVnKVmnLUV@bn¤lLXK²`nnlJXIVJIVnn°KnnVll@VLXWV@UkVaVKzV@VVaUK@U»VUl@@WnUU@wVLn@Vwl@XW°LVbn@VU@Xl`@XnKVbkl@XVJlUnlVxlL@lnXl@VUnV°°@aUVLXblWVXn@VVUV@L¤VLVUVbnalLUUVX_laVaWVzXKV@@a@KUmImmXama@kU@yVIUKaVa@kXK@aWU@VIUmW@kkVmU@VwUa@K@k@U`@kUKVk@UV@VaUm²Vy@klUUWUkVmUa@_KVaXaXmU@mUlWkaUX@mmkL@wJnVVÅbWKXa@@I@aJUUÇ@VULW@akLmb@K@aXXw@mVmUVkUy@£@aU@@VkUWm@kUKXUWU_mW@wkkmJUUkLWWUXW@IkJ@k@mW_kÓ_UlLm@I@aUa¯m@ka¯LUJ@mVVxUba@LUKkXbm@Uak@@a@Um`IUbUJ@nUVW@@LnVV@lUbVlUX@`@blXklWUmXlm¦U@@V¯bml@@nUb@llnn@VbX@lV@UVULmU@JVnbVbkbVWxU@@nUVk@'],
                    'encodeOffsets': [[
                            121546,
                            28992
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3301',
                'properties': {
                    'name': '杭州市',
                    'cp': [
                        119.5313,
                        29.8773
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X@l°KXXlWb@²`bIX`l@@bWl@n@VnLUV@V@°¦@l@XVlU@@xVbUb@Vkb@@XVJVzJ@LÞ@VmLUxUJ@LUVxbxXUl@VaÈwbaÞa@Vl@XUVx@V@VLlbnVal@lbVnnLnKnL@VlbVJXalIb@KUU@mVInJUVl@xUVLnU@UÞaV@lkV@UanKL@UlKVUnbÆmn@@nUlVnVJl@@UXUL@WVIVJVxVLXV@IÜKnbn@V¥V@@I@y°b@UUwnk°ÆƨVlUçXm£aÇIkV@WV@@aWIUWUIkb@WW@UnK@UU@kaWVkVIVVnU@UWVUV@VmVkKkWIkVWaULU`UImJUImmU@wmwUVIUWVkUamaU@mVkb@KVU@aVU@anKULVJU@kÛUJUVkkVakU@aVwkW@UWkXmWaULUaUK@XJUUmVU@UVUkJ@ImwmKU@k@lUW@@akKmkamIkWl_UwVm@UkaVUUa@UamakbWlkL@aUalU@mkL@U@UlmK@XkKm@Ýakb@xnXb`nUUU@U@wU@@mKkkV¯U@lULUbVbUb@Va@LºÝb@bLmKx@VUL@bk@mxULWl'],
                    'encodeOffsets': [[
                            121185,
                            30184
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3303',
                'properties': {
                    'name': '温州市',
                    'cp': [
                        120.498,
                        27.8119
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ll@xnXV`VXWVL@lXnlV@UV@@b@¤VzUlnVU@nWxW@b@LnalK@bXVKUÈ@VVI@b@J@WbXLÆaUUmI@xlKnn@VWlbkXV@nVWnWbUbL@`VbUnVlVXkV@lUz±VnUbU@@VUlVL@l_@V@l@LVbV@XLV`VÈlxn@lU@aaVVk@XJ@nl@@LU`°LVbL°a@aUVy@anI@aanV@²wÜJX@VVV°kna@WVkaWwU@m@kaUĕÝÝŤnÈaaóI»@±XWkUķ@kV±kwUkWwUÝ»ÛkɳlImaUaWóXÿǬkUnWVmmkKţnŏÞğlUlUx@XWbV@JkX°mb@VULVxUVk@@LWWk@WIkUkJmUkVmI@y@UakLmU@mUUUkaVk@mK@UlUU@UmKmbUUUJ@n@KVLUL@VkJWXX`mnULWlkL@JVLVb@°kxkU@LVV@VLV`UL@VUX'],
                    'encodeOffsets': [[
                            122502,
                            28334
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3302',
                'properties': {
                    'name': '宁波市',
                    'cp': [
                        121.5967,
                        29.6466
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ċ¦ĸĀ°nXÞVKkƨƑźÿ°»n@wô¥ÜbU°ÆXÞWóçĉÝ±IUÈ¥@U°wÆ»²mm_@aXVKÞVlk@akk̅@£X»VwÆXWa¯aȗbKƽŰĊxLók@@¯nKUL@xkLÑkWULUUmJUXVU@mUX¯@V`mbXbV@@nn¤WXx@kJ@nVVUVl²UbÝVUVk@Wx@V@VXzmlaL@VlLU`XUVVVUnl@VbnJlnUVVnlUKkbmnnVxlJnxmbU@UL@KUVX@xmb@lk@mnVVUè'],
                    'encodeOffsets': [[
                            123784,
                            30977
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3309',
                'properties': {
                    'name': '舟山市',
                    'cp': [
                        122.2559,
                        30.2234
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l΢ƒʠþÆVĢLĊǬXĊÜXôVÑÆwlƏÈóVĭVǓ@ĉwɛkmK@ĉXīWaĉUĵÝm¯ĉwĉ±±nÅ¼¯x@VÇ¦V²JĊÞôèÝXÅW¯VÛaó¦@xm¯¼ŹĀ'],
                    'encodeOffsets': [[
                            124437,
                            30983
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3310',
                'properties': {
                    'name': '台州市',
                    'cp': [
                        121.1353,
                        28.6688
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lVIVWVz@bXJl@Xal@°nLll@nVxnVK@UJVb¦°k`UIWJXnÆ@bUJXl@lbWn@UzVV@bVVmVnnJVXnabKUKnUVVUnVLlKVLXaJm£@mU@WanaU_°@VWnV@UVWnIVVVKlXÒlK@wVKL°m@l@ôKwĉƾůUl£@»UVkm@ƅUaÛIŏmUk@mw@a£Wk@ţIm±@ankôUlaUUw¯ōabÇbţmÞÞVĖbl@@nVXxbUl@Xmb¯lUUUW@ÛI±xU@mb@bmJ@bUzV@b¯bKUa¯KV_@Kk@@mWI@lUUb@bkVm@kwUÇU_WKU@Ux@VUnllX@VnJ@UXV@bWL@lUbbVLUJ@zV@lnbWbnnnJV@L'],
                    'encodeOffsets': [[
                            123312,
                            29526
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3307',
                'properties': {
                    'name': '金华市',
                    'cp': [
                        120.0037,
                        29.1028
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nbVb@VbUVlb@VUnVxk`lXnJlbnlL@bX@V@klV@nLnx@JlIVU@VUVnVVI@WVLVbVKXbWnXl@VlXUxb@lVUbllVUIÜVnalKX@@bV@@aUUlUwUw@naWWUVaUUaVbLlxXJVk°UlkU¥@ka@LVlXLVlVWznVn@lxJl_@WX_@mVaa@alU@kVVnaKVLlKb@UUaVabnUWmXU@k@yVI@aÅWmXIVJl_¯¥UaVI@LmUUw@mkkmK¯k@Wbk@WI@aUyUXJkU@bU@WLUyXUbkbW`UVVkKmbUaVUUK£@KVUUUm@UWkXWaUKV@b¯¯mUV@UkmW@kkKwUmkkVUI@WlkUamL@Wk_W@UVm@Ua¯KWXk@Uxm@UK@xVmV@Xk@UVV¼@VLUbUU@yULUbVlU@@XlVUVVbU@lXXVW@XUVl@@VUVÈn@VVU@lVa@UmL@`X@`WL@VUX@lUL@xlx'],
                    'encodeOffsets': [[
                            122119,
                            29948
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3308',
                'properties': {
                    'name': '衢州市',
                    'cp': [
                        118.6853,
                        28.8666
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XkVKnwl@@aVK@UwnLK@aÞa¹@Kb@UVaUaVaVK@k°VUllnL@V@xV@V@VVm_Wam@wlaÞbn@lL@WnLk@V@VlK@nkVVb@blKXklakw@wVK@kVW@UXK@_W@_nKV@Ub@kVUUm@ÇVU@Uk@VU@WUXWW@kVUaVUkU@WWXUKk@Ukmm¯LmmUJUIWJkImm_±WLkKm£@aVUmKUnLmWUkVmw@¥ULVWm@WUka@UmmLmm@@bUX@@WUIm@UVUK@UVUUUVVJmb@bXnmV¼nnn¦mJUVLV@VW@UzUlVnUbl`UnVl@XU@kl@bmÈUxVk@@J@¼W@ÅaVVnzmV@WJk@kWJ@lXbWbXxmVnlLXb@°lKVXnWbWVXmbV@XlbI@Kn@@x@VLlm'],
                    'encodeOffsets': [[
                            121185,
                            30184
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3306',
                'properties': {
                    'name': '绍兴市',
                    'cp': [
                        120.564,
                        29.7565
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@x@VnnVJnIVJV_VKXblUXJllLUUnU@UVVX@mVUUUJlXUlbV@@VLVmX@@XlaVJVXXJ@b@XU@lUJÈb¤ŌJçVUUnml@@kna@wWVU@LVKV@namwkIUwmnmlaVLkUmVUkmmIUak@VmUUVUWV_kK@UKbnkWyU@@UXwl@VUÞUVak±VUUU@mlI@wXWIWbUKkLUKVmUUmVVLLambUWmIUmnUU@aUUVym@Xkak@W@z@lWVXnmVaUbVb@VakLUKLmbUU@lkV@bbUb@nW`@Xk`Ikwm@mUXyUUkWKUk@Kb@lV¦klV¯UlWIkwKUabVVUbVXXmb@VxxkVVV@bU@@aW@kLmb@lVUIVKmL@bUV@bUV@LalnUV@nbVbUlVXJVUnx'],
                    'encodeOffsets': [[
                            122997,
                            30561
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3304',
                'properties': {
                    'name': '嘉兴市',
                    'cp': [
                        120.9155,
                        30.6354
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@blIX@@VÜVUnn@lklKnI°Þl`²LVKVbnbVaVLUVn@W¦@VkVVb@VI`@blLnLaX@VVb@U@XlVa@@kVaUKV»U_lWXU@albk@VllnLVKn@@UVIUw@y°IVVXU@VV@lwm@wVkƾaJLkΡƧƒlLÝUmW¯ķÿĉ¥IŋWnèkVƧU¯ÅmlVx@V¯az@@JU@U¦m@@nVmn@VLV'],
                    'encodeOffsets': [[
                            123233,
                            31382
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3305',
                'properties': {
                    'name': '湖州市',
                    'cp': [
                        119.8608,
                        30.7782
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kLlkm@VmÛU@UW@kJ@aUK@UnmmU@maÛL@JWUUKUwUIUJ@XKWV@Vk@UIUmVk@mm@ÅnmaUVkL@VKmLVbU@klU@ÝbV@mVUKV@wUkVmIUJ@nVV@LakJWbUIka@UmKmLKmmUUVk@@nmLX`WXUV@@nUlkmlU@UbxVVIlVnn@@nUÒ@°n@@xmb@VbnV@@b@`@L@L@x@blVklVbnnV@aXb°VlU@Wb°ULXWVUVVwÈwÜ»ĸaĠnUVw²X@V@lVU@wlaUUVm@knUV'],
                    'encodeOffsets': [[
                            123379,
                            31500
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/chart/gauge', [
    'require',
    './base',
    '../util/shape/GaugePointer',
    'zrender/shape/Text',
    'zrender/shape/Line',
    'zrender/shape/Rectangle',
    'zrender/shape/Circle',
    'zrender/shape/Sector',
    '../config',
    '../util/ecData',
    '../util/accMath',
    'zrender/tool/util',
    '../chart'
], function (require) {
    var ChartBase = require('./base');
    var GaugePointerShape = require('../util/shape/GaugePointer');
    var TextShape = require('zrender/shape/Text');
    var LineShape = require('zrender/shape/Line');
    var RectangleShape = require('zrender/shape/Rectangle');
    var CircleShape = require('zrender/shape/Circle');
    var SectorShape = require('zrender/shape/Sector');
    var ecConfig = require('../config');
    ecConfig.gauge = {
        zlevel: 0,
        z: 2,
        center: [
            '50%',
            '50%'
        ],
        clickable: true,
        legendHoverLink: true,
        radius: '75%',
        startAngle: 225,
        endAngle: -45,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
            show: true,
            lineStyle: {
                color: [
                    [
                        0.2,
                        '#228b22'
                    ],
                    [
                        0.8,
                        '#48b'
                    ],
                    [
                        1,
                        '#ff4500'
                    ]
                ],
                width: 30
            }
        },
        axisTick: {
            show: true,
            splitNumber: 5,
            length: 8,
            lineStyle: {
                color: '#eee',
                width: 1,
                type: 'solid'
            }
        },
        axisLabel: {
            show: true,
            textStyle: { color: 'auto' }
        },
        splitLine: {
            show: true,
            length: 30,
            lineStyle: {
                color: '#eee',
                width: 2,
                type: 'solid'
            }
        },
        pointer: {
            show: true,
            length: '80%',
            width: 8,
            color: 'auto'
        },
        title: {
            show: true,
            offsetCenter: [
                0,
                '-40%'
            ],
            textStyle: {
                color: '#333',
                fontSize: 15
            }
        },
        detail: {
            show: true,
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            borderColor: '#ccc',
            width: 100,
            height: 40,
            offsetCenter: [
                0,
                '40%'
            ],
            textStyle: {
                color: 'auto',
                fontSize: 30
            }
        }
    };
    var ecData = require('../util/ecData');
    var accMath = require('../util/accMath');
    var zrUtil = require('zrender/tool/util');
    function Gauge(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.refresh(option);
    }
    Gauge.prototype = {
        type: ecConfig.CHART_TYPE_GAUGE,
        _buildShape: function () {
            var series = this.series;
            this._paramsMap = {};
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type === ecConfig.CHART_TYPE_GAUGE) {
                    series[i] = this.reformOption(series[i]);
                    this.legendHoverLink = series[i].legendHoverLink || this.legendHoverLink;
                    this._buildSingleGauge(i);
                    this.buildMark(i);
                }
            }
            this.addShapeList();
        },
        _buildSingleGauge: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            this._paramsMap[seriesIndex] = {
                center: this.parseCenter(this.zr, serie.center),
                radius: this.parseRadius(this.zr, serie.radius),
                startAngle: serie.startAngle.toFixed(2) - 0,
                endAngle: serie.endAngle.toFixed(2) - 0
            };
            this._paramsMap[seriesIndex].totalAngle = this._paramsMap[seriesIndex].startAngle - this._paramsMap[seriesIndex].endAngle;
            this._colorMap(seriesIndex);
            this._buildAxisLine(seriesIndex);
            this._buildSplitLine(seriesIndex);
            this._buildAxisTick(seriesIndex);
            this._buildAxisLabel(seriesIndex);
            this._buildPointer(seriesIndex);
            this._buildTitle(seriesIndex);
            this._buildDetail(seriesIndex);
        },
        _buildAxisLine: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.axisLine.show) {
                return;
            }
            var min = serie.min;
            var total = serie.max - min;
            var params = this._paramsMap[seriesIndex];
            var center = params.center;
            var startAngle = params.startAngle;
            var totalAngle = params.totalAngle;
            var colorArray = params.colorArray;
            var lineStyle = serie.axisLine.lineStyle;
            var lineWidth = this.parsePercent(lineStyle.width, params.radius[1]);
            var r = params.radius[1];
            var r0 = r - lineWidth;
            var sectorShape;
            var lastAngle = startAngle;
            var newAngle;
            for (var i = 0, l = colorArray.length; i < l; i++) {
                newAngle = startAngle - totalAngle * (colorArray[i][0] - min) / total;
                sectorShape = this._getSector(center, r0, r, newAngle, lastAngle, colorArray[i][1], lineStyle);
                lastAngle = newAngle;
                sectorShape._animationAdd = 'r';
                ecData.set(sectorShape, 'seriesIndex', seriesIndex);
                ecData.set(sectorShape, 'dataIndex', i);
                this.shapeList.push(sectorShape);
            }
        },
        _buildSplitLine: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.splitLine.show) {
                return;
            }
            var params = this._paramsMap[seriesIndex];
            var splitNumber = serie.splitNumber;
            var min = serie.min;
            var total = serie.max - min;
            var splitLine = serie.splitLine;
            var length = this.parsePercent(splitLine.length, params.radius[1]);
            var lineStyle = splitLine.lineStyle;
            var color = lineStyle.color;
            var center = params.center;
            var startAngle = params.startAngle * Math.PI / 180;
            var totalAngle = params.totalAngle * Math.PI / 180;
            var r = params.radius[1];
            var r0 = r - length;
            var angle;
            var sinAngle;
            var cosAngle;
            for (var i = 0; i <= splitNumber; i++) {
                angle = startAngle - totalAngle / splitNumber * i;
                sinAngle = Math.sin(angle);
                cosAngle = Math.cos(angle);
                this.shapeList.push(new LineShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + 1,
                    hoverable: false,
                    style: {
                        xStart: center[0] + cosAngle * r,
                        yStart: center[1] - sinAngle * r,
                        xEnd: center[0] + cosAngle * r0,
                        yEnd: center[1] - sinAngle * r0,
                        strokeColor: color === 'auto' ? this._getColor(seriesIndex, min + total / splitNumber * i) : color,
                        lineType: lineStyle.type,
                        lineWidth: lineStyle.width,
                        shadowColor: lineStyle.shadowColor,
                        shadowBlur: lineStyle.shadowBlur,
                        shadowOffsetX: lineStyle.shadowOffsetX,
                        shadowOffsetY: lineStyle.shadowOffsetY
                    }
                }));
            }
        },
        _buildAxisTick: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.axisTick.show) {
                return;
            }
            var params = this._paramsMap[seriesIndex];
            var splitNumber = serie.splitNumber;
            var min = serie.min;
            var total = serie.max - min;
            var axisTick = serie.axisTick;
            var tickSplit = axisTick.splitNumber;
            var length = this.parsePercent(axisTick.length, params.radius[1]);
            var lineStyle = axisTick.lineStyle;
            var color = lineStyle.color;
            var center = params.center;
            var startAngle = params.startAngle * Math.PI / 180;
            var totalAngle = params.totalAngle * Math.PI / 180;
            var r = params.radius[1];
            var r0 = r - length;
            var angle;
            var sinAngle;
            var cosAngle;
            for (var i = 0, l = splitNumber * tickSplit; i <= l; i++) {
                if (i % tickSplit === 0) {
                    continue;
                }
                angle = startAngle - totalAngle / l * i;
                sinAngle = Math.sin(angle);
                cosAngle = Math.cos(angle);
                this.shapeList.push(new LineShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + 1,
                    hoverable: false,
                    style: {
                        xStart: center[0] + cosAngle * r,
                        yStart: center[1] - sinAngle * r,
                        xEnd: center[0] + cosAngle * r0,
                        yEnd: center[1] - sinAngle * r0,
                        strokeColor: color === 'auto' ? this._getColor(seriesIndex, min + total / l * i) : color,
                        lineType: lineStyle.type,
                        lineWidth: lineStyle.width,
                        shadowColor: lineStyle.shadowColor,
                        shadowBlur: lineStyle.shadowBlur,
                        shadowOffsetX: lineStyle.shadowOffsetX,
                        shadowOffsetY: lineStyle.shadowOffsetY
                    }
                }));
            }
        },
        _buildAxisLabel: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.axisLabel.show) {
                return;
            }
            var splitNumber = serie.splitNumber;
            var min = serie.min;
            var total = serie.max - min;
            var textStyle = serie.axisLabel.textStyle;
            var textFont = this.getFont(textStyle);
            var color = textStyle.color;
            var params = this._paramsMap[seriesIndex];
            var center = params.center;
            var startAngle = params.startAngle;
            var totalAngle = params.totalAngle;
            var r0 = params.radius[1] - this.parsePercent(serie.splitLine.length, params.radius[1]) - 5;
            var angle;
            var sinAngle;
            var cosAngle;
            var value;
            for (var i = 0; i <= splitNumber; i++) {
                value = accMath.accAdd(min, accMath.accMul(accMath.accDiv(total, splitNumber), i));
                angle = startAngle - totalAngle / splitNumber * i;
                sinAngle = Math.sin(angle * Math.PI / 180);
                cosAngle = Math.cos(angle * Math.PI / 180);
                angle = (angle + 360) % 360;
                this.shapeList.push(new TextShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + 1,
                    hoverable: false,
                    style: {
                        x: center[0] + cosAngle * r0,
                        y: center[1] - sinAngle * r0,
                        color: color === 'auto' ? this._getColor(seriesIndex, value) : color,
                        text: this._getLabelText(serie.axisLabel.formatter, value),
                        textAlign: angle >= 110 && angle <= 250 ? 'left' : angle <= 70 || angle >= 290 ? 'right' : 'center',
                        textBaseline: angle >= 10 && angle <= 170 ? 'top' : angle >= 190 && angle <= 350 ? 'bottom' : 'middle',
                        textFont: textFont,
                        shadowColor: textStyle.shadowColor,
                        shadowBlur: textStyle.shadowBlur,
                        shadowOffsetX: textStyle.shadowOffsetX,
                        shadowOffsetY: textStyle.shadowOffsetY
                    }
                }));
            }
        },
        _buildPointer: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.pointer.show) {
                return;
            }
            var total = serie.max - serie.min;
            var pointer = serie.pointer;
            var params = this._paramsMap[seriesIndex];
            var length = this.parsePercent(pointer.length, params.radius[1]);
            var width = this.parsePercent(pointer.width, params.radius[1]);
            var center = params.center;
            var value = this._getValue(seriesIndex);
            value = value < serie.max ? value : serie.max;
            var angle = (params.startAngle - params.totalAngle / total * (value - serie.min)) * Math.PI / 180;
            var color = pointer.color === 'auto' ? this._getColor(seriesIndex, value) : pointer.color;
            var pointShape = new GaugePointerShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                clickable: this.query(serie, 'clickable'),
                style: {
                    x: center[0],
                    y: center[1],
                    r: length,
                    startAngle: params.startAngle * Math.PI / 180,
                    angle: angle,
                    color: color,
                    width: width,
                    shadowColor: pointer.shadowColor,
                    shadowBlur: pointer.shadowBlur,
                    shadowOffsetX: pointer.shadowOffsetX,
                    shadowOffsetY: pointer.shadowOffsetY
                },
                highlightStyle: {
                    brushType: 'fill',
                    width: width > 2 ? 2 : width / 2,
                    color: '#fff'
                }
            });
            ecData.pack(pointShape, this.series[seriesIndex], seriesIndex, this.series[seriesIndex].data[0], 0, this.series[seriesIndex].data[0].name, value);
            this.shapeList.push(pointShape);
            this.shapeList.push(new CircleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 2,
                hoverable: false,
                style: {
                    x: center[0],
                    y: center[1],
                    r: pointer.width / 2.5,
                    color: '#fff'
                }
            }));
        },
        _buildTitle: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.title.show) {
                return;
            }
            var data = serie.data[0];
            var name = data.name != null ? data.name : '';
            if (name !== '') {
                var title = serie.title;
                var offsetCenter = title.offsetCenter;
                var textStyle = title.textStyle;
                var textColor = textStyle.color;
                var params = this._paramsMap[seriesIndex];
                var x = params.center[0] + this.parsePercent(offsetCenter[0], params.radius[1]);
                var y = params.center[1] + this.parsePercent(offsetCenter[1], params.radius[1]);
                this.shapeList.push(new TextShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + (Math.abs(x - params.center[0]) + Math.abs(y - params.center[1]) < textStyle.fontSize * 2 ? 2 : 1),
                    hoverable: false,
                    style: {
                        x: x,
                        y: y,
                        color: textColor === 'auto' ? this._getColor(seriesIndex) : textColor,
                        text: name,
                        textAlign: 'center',
                        textFont: this.getFont(textStyle),
                        shadowColor: textStyle.shadowColor,
                        shadowBlur: textStyle.shadowBlur,
                        shadowOffsetX: textStyle.shadowOffsetX,
                        shadowOffsetY: textStyle.shadowOffsetY
                    }
                }));
            }
        },
        _buildDetail: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (!serie.detail.show) {
                return;
            }
            var detail = serie.detail;
            var offsetCenter = detail.offsetCenter;
            var color = detail.backgroundColor;
            var textStyle = detail.textStyle;
            var textColor = textStyle.color;
            var params = this._paramsMap[seriesIndex];
            var value = this._getValue(seriesIndex);
            var x = params.center[0] - detail.width / 2 + this.parsePercent(offsetCenter[0], params.radius[1]);
            var y = params.center[1] + this.parsePercent(offsetCenter[1], params.radius[1]);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + (Math.abs(x + detail.width / 2 - params.center[0]) + Math.abs(y + detail.height / 2 - params.center[1]) < textStyle.fontSize ? 2 : 1),
                hoverable: false,
                style: {
                    x: x,
                    y: y,
                    width: detail.width,
                    height: detail.height,
                    brushType: 'both',
                    color: color === 'auto' ? this._getColor(seriesIndex, value) : color,
                    lineWidth: detail.borderWidth,
                    strokeColor: detail.borderColor,
                    shadowColor: detail.shadowColor,
                    shadowBlur: detail.shadowBlur,
                    shadowOffsetX: detail.shadowOffsetX,
                    shadowOffsetY: detail.shadowOffsetY,
                    text: this._getLabelText(detail.formatter, value),
                    textFont: this.getFont(textStyle),
                    textPosition: 'inside',
                    textColor: textColor === 'auto' ? this._getColor(seriesIndex, value) : textColor
                }
            }));
        },
        _getValue: function (seriesIndex) {
            return this.getDataFromOption(this.series[seriesIndex].data[0]);
        },
        _colorMap: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            var min = serie.min;
            var total = serie.max - min;
            var color = serie.axisLine.lineStyle.color;
            if (!(color instanceof Array)) {
                color = [[
                        1,
                        color
                    ]];
            }
            var colorArray = [];
            for (var i = 0, l = color.length; i < l; i++) {
                colorArray.push([
                    color[i][0] * total + min,
                    color[i][1]
                ]);
            }
            this._paramsMap[seriesIndex].colorArray = colorArray;
        },
        _getColor: function (seriesIndex, value) {
            if (value == null) {
                value = this._getValue(seriesIndex);
            }
            var colorArray = this._paramsMap[seriesIndex].colorArray;
            for (var i = 0, l = colorArray.length; i < l; i++) {
                if (colorArray[i][0] >= value) {
                    return colorArray[i][1];
                }
            }
            return colorArray[colorArray.length - 1][1];
        },
        _getSector: function (center, r0, r, startAngle, endAngle, color, lineStyle) {
            return new SectorShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: center[0],
                    y: center[1],
                    r0: r0,
                    r: r,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    brushType: 'fill',
                    color: color,
                    shadowColor: lineStyle.shadowColor,
                    shadowBlur: lineStyle.shadowBlur,
                    shadowOffsetX: lineStyle.shadowOffsetX,
                    shadowOffsetY: lineStyle.shadowOffsetY
                }
            });
        },
        _getLabelText: function (formatter, value) {
            if (formatter) {
                if (typeof formatter === 'function') {
                    return formatter.call(this.myChart, value);
                } else if (typeof formatter === 'string') {
                    return formatter.replace('{value}', value);
                }
            }
            return value;
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }
            this.backupShapeList();
            this._buildShape();
        }
    };
    zrUtil.inherits(Gauge, ChartBase);
    require('../chart').define('gauge', Gauge);
    return Gauge;
});define('echarts/util/shape/GaugePointer', [
    'require',
    'zrender/shape/Base',
    'zrender/tool/util',
    './normalIsCover'
], function (require) {
    var Base = require('zrender/shape/Base');
    var zrUtil = require('zrender/tool/util');
    function GaugePointer(options) {
        Base.call(this, options);
    }
    GaugePointer.prototype = {
        type: 'gauge-pointer',
        buildPath: function (ctx, style) {
            var r = style.r;
            var width = style.width;
            var angle = style.angle;
            var x = style.x - Math.cos(angle) * width * (width >= r / 3 ? 1 : 2);
            var y = style.y + Math.sin(angle) * width * (width >= r / 3 ? 1 : 2);
            angle = style.angle - Math.PI / 2;
            ctx.moveTo(x, y);
            ctx.lineTo(style.x + Math.cos(angle) * width, style.y - Math.sin(angle) * width);
            ctx.lineTo(style.x + Math.cos(style.angle) * r, style.y - Math.sin(style.angle) * r);
            ctx.lineTo(style.x - Math.cos(angle) * width, style.y + Math.sin(angle) * width);
            ctx.lineTo(x, y);
            return;
        },
        getRect: function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            var width = style.width * 2;
            var xStart = style.x;
            var yStart = style.y;
            var xEnd = xStart + Math.cos(style.angle) * style.r;
            var yEnd = yStart - Math.sin(style.angle) * style.r;
            style.__rect = {
                x: Math.min(xStart, xEnd) - width,
                y: Math.min(yStart, yEnd) - width,
                width: Math.abs(xStart - xEnd) + width,
                height: Math.abs(yStart - yEnd) + width
            };
            return style.__rect;
        },
        isCover: require('./normalIsCover')
    };
    zrUtil.inherits(GaugePointer, Base);
    return GaugePointer;
});define('echarts/chart/funnel', [
    'require',
    './base',
    'zrender/shape/Text',
    'zrender/shape/Line',
    'zrender/shape/Polygon',
    '../config',
    '../util/ecData',
    '../util/number',
    'zrender/tool/util',
    'zrender/tool/color',
    'zrender/tool/area',
    '../chart'
], function (require) {
    var ChartBase = require('./base');
    var TextShape = require('zrender/shape/Text');
    var LineShape = require('zrender/shape/Line');
    var PolygonShape = require('zrender/shape/Polygon');
    var ecConfig = require('../config');
    ecConfig.funnel = {
        zlevel: 0,
        z: 2,
        clickable: true,
        legendHoverLink: true,
        x: 80,
        y: 60,
        x2: 80,
        y2: 60,
        min: 0,
        max: 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 0,
        funnelAlign: 'center',
        itemStyle: {
            normal: {
                borderColor: '#fff',
                borderWidth: 1,
                label: {
                    show: true,
                    position: 'outer'
                },
                labelLine: {
                    show: true,
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid'
                    }
                }
            },
            emphasis: {
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                label: { show: true },
                labelLine: { show: true }
            }
        }
    };
    var ecData = require('../util/ecData');
    var number = require('../util/number');
    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');
    var zrArea = require('zrender/tool/area');
    function Funnel(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.refresh(option);
    }
    Funnel.prototype = {
        type: ecConfig.CHART_TYPE_FUNNEL,
        _buildShape: function () {
            var series = this.series;
            var legend = this.component.legend;
            this._paramsMap = {};
            this._selected = {};
            this.selectedMap = {};
            var serieName;
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type === ecConfig.CHART_TYPE_FUNNEL) {
                    series[i] = this.reformOption(series[i]);
                    this.legendHoverLink = series[i].legendHoverLink || this.legendHoverLink;
                    serieName = series[i].name || '';
                    this.selectedMap[serieName] = legend ? legend.isSelected(serieName) : true;
                    if (!this.selectedMap[serieName]) {
                        continue;
                    }
                    this._buildSingleFunnel(i);
                    this.buildMark(i);
                }
            }
            this.addShapeList();
        },
        _buildSingleFunnel: function (seriesIndex) {
            var legend = this.component.legend;
            var serie = this.series[seriesIndex];
            var data = this._mapData(seriesIndex);
            var location = this._getLocation(seriesIndex);
            this._paramsMap[seriesIndex] = {
                location: location,
                data: data
            };
            var itemName;
            var total = 0;
            var selectedData = [];
            for (var i = 0, l = data.length; i < l; i++) {
                itemName = data[i].name;
                this.selectedMap[itemName] = legend ? legend.isSelected(itemName) : true;
                if (this.selectedMap[itemName] && !isNaN(data[i].value)) {
                    selectedData.push(data[i]);
                    total++;
                }
            }
            if (total === 0) {
                return;
            }
            var funnelCase = this._buildFunnelCase(seriesIndex);
            var align = serie.funnelAlign;
            var gap = serie.gap;
            var height = total > 1 ? (location.height - (total - 1) * gap) / total : location.height;
            var width;
            var lastY = location.y;
            var lastWidth = serie.sort === 'descending' ? this._getItemWidth(seriesIndex, selectedData[0].value) : number.parsePercent(serie.minSize, location.width);
            var next = serie.sort === 'descending' ? 1 : 0;
            var centerX = location.centerX;
            var pointList = [];
            var x;
            var polygon;
            var lastPolygon;
            for (var i = 0, l = selectedData.length; i < l; i++) {
                itemName = selectedData[i].name;
                if (this.selectedMap[itemName] && !isNaN(selectedData[i].value)) {
                    width = i <= l - 2 ? this._getItemWidth(seriesIndex, selectedData[i + next].value) : serie.sort === 'descending' ? number.parsePercent(serie.minSize, location.width) : number.parsePercent(serie.maxSize, location.width);
                    switch (align) {
                    case 'left':
                        x = location.x;
                        break;
                    case 'right':
                        x = location.x + location.width - lastWidth;
                        break;
                    default:
                        x = centerX - lastWidth / 2;
                    }
                    polygon = this._buildItem(seriesIndex, selectedData[i]._index, legend ? legend.getColor(itemName) : this.zr.getColor(selectedData[i]._index), x, lastY, lastWidth, width, height, align);
                    lastY += height + gap;
                    lastPolygon = polygon.style.pointList;
                    pointList.unshift([
                        lastPolygon[0][0] - 10,
                        lastPolygon[0][1]
                    ]);
                    pointList.push([
                        lastPolygon[1][0] + 10,
                        lastPolygon[1][1]
                    ]);
                    if (i === 0) {
                        if (lastWidth === 0) {
                            lastPolygon = pointList.pop();
                            align == 'center' && (pointList[0][0] += 10);
                            align == 'right' && (pointList[0][0] = lastPolygon[0]);
                            pointList[0][1] -= align == 'center' ? 10 : 15;
                            if (l == 1) {
                                lastPolygon = polygon.style.pointList;
                            }
                        } else {
                            pointList[pointList.length - 1][1] -= 5;
                            pointList[0][1] -= 5;
                        }
                    }
                    lastWidth = width;
                }
            }
            if (funnelCase) {
                pointList.unshift([
                    lastPolygon[3][0] - 10,
                    lastPolygon[3][1]
                ]);
                pointList.push([
                    lastPolygon[2][0] + 10,
                    lastPolygon[2][1]
                ]);
                if (lastWidth === 0) {
                    lastPolygon = pointList.pop();
                    align == 'center' && (pointList[0][0] += 10);
                    align == 'right' && (pointList[0][0] = lastPolygon[0]);
                    pointList[0][1] += align == 'center' ? 10 : 15;
                } else {
                    pointList[pointList.length - 1][1] += 5;
                    pointList[0][1] += 5;
                }
                funnelCase.style.pointList = pointList;
            }
        },
        _buildFunnelCase: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            if (this.deepQuery([
                    serie,
                    this.option
                ], 'calculable')) {
                var location = this._paramsMap[seriesIndex].location;
                var gap = 10;
                var funnelCase = {
                    hoverable: false,
                    style: {
                        pointListd: [
                            [
                                location.x - gap,
                                location.y - gap
                            ],
                            [
                                location.x + location.width + gap,
                                location.y - gap
                            ],
                            [
                                location.x + location.width + gap,
                                location.y + location.height + gap
                            ],
                            [
                                location.x - gap,
                                location.y + location.height + gap
                            ]
                        ],
                        brushType: 'stroke',
                        lineWidth: 1,
                        strokeColor: serie.calculableHolderColor || this.ecTheme.calculableHolderColor || ecConfig.calculableHolderColor
                    }
                };
                ecData.pack(funnelCase, serie, seriesIndex, undefined, -1);
                this.setCalculable(funnelCase);
                funnelCase = new PolygonShape(funnelCase);
                this.shapeList.push(funnelCase);
                return funnelCase;
            }
        },
        _getLocation: function (seriesIndex) {
            var gridOption = this.series[seriesIndex];
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            var x = this.parsePercent(gridOption.x, zrWidth);
            var y = this.parsePercent(gridOption.y, zrHeight);
            var width = gridOption.width == null ? zrWidth - x - this.parsePercent(gridOption.x2, zrWidth) : this.parsePercent(gridOption.width, zrWidth);
            return {
                x: x,
                y: y,
                width: width,
                height: gridOption.height == null ? zrHeight - y - this.parsePercent(gridOption.y2, zrHeight) : this.parsePercent(gridOption.height, zrHeight),
                centerX: x + width / 2
            };
        },
        _mapData: function (seriesIndex) {
            var serie = this.series[seriesIndex];
            var funnelData = zrUtil.clone(serie.data);
            for (var i = 0, l = funnelData.length; i < l; i++) {
                funnelData[i]._index = i;
            }
            function numDescending(a, b) {
                if (a.value === '-') {
                    return 1;
                } else if (b.value === '-') {
                    return -1;
                }
                return b.value - a.value;
            }
            function numAscending(a, b) {
                return -numDescending(a, b);
            }
            if (serie.sort != 'none') {
                funnelData.sort(serie.sort === 'descending' ? numDescending : numAscending);
            }
            return funnelData;
        },
        _buildItem: function (seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align) {
            var series = this.series;
            var serie = series[seriesIndex];
            var data = serie.data[dataIndex];
            var polygon = this.getPolygon(seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align);
            ecData.pack(polygon, series[seriesIndex], seriesIndex, series[seriesIndex].data[dataIndex], dataIndex, series[seriesIndex].data[dataIndex].name);
            this.shapeList.push(polygon);
            var label = this.getLabel(seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align);
            ecData.pack(label, series[seriesIndex], seriesIndex, series[seriesIndex].data[dataIndex], dataIndex, series[seriesIndex].data[dataIndex].name);
            this.shapeList.push(label);
            if (!this._needLabel(serie, data, false)) {
                label.invisible = true;
            }
            var labelLine = this.getLabelLine(seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align);
            this.shapeList.push(labelLine);
            if (!this._needLabelLine(serie, data, false)) {
                labelLine.invisible = true;
            }
            var polygonHoverConnect = [];
            var labelHoverConnect = [];
            if (this._needLabelLine(serie, data, true)) {
                polygonHoverConnect.push(labelLine.id);
                labelHoverConnect.push(labelLine.id);
            }
            if (this._needLabel(serie, data, true)) {
                polygonHoverConnect.push(label.id);
                labelHoverConnect.push(polygon.id);
            }
            polygon.hoverConnect = polygonHoverConnect;
            label.hoverConnect = labelHoverConnect;
            return polygon;
        },
        _getItemWidth: function (seriesIndex, value) {
            var serie = this.series[seriesIndex];
            var location = this._paramsMap[seriesIndex].location;
            var min = serie.min;
            var max = serie.max;
            var minSize = number.parsePercent(serie.minSize, location.width);
            var maxSize = number.parsePercent(serie.maxSize, location.width);
            return (value - min) * (maxSize - minSize) / (max - min) + minSize;
        },
        getPolygon: function (seriesIndex, dataIndex, defaultColor, xLT, y, topWidth, bottomWidth, height, align) {
            var serie = this.series[seriesIndex];
            var data = serie.data[dataIndex];
            var queryTarget = [
                data,
                serie
            ];
            var normal = this.deepMerge(queryTarget, 'itemStyle.normal') || {};
            var emphasis = this.deepMerge(queryTarget, 'itemStyle.emphasis') || {};
            var normalColor = this.getItemStyleColor(normal.color, seriesIndex, dataIndex, data) || defaultColor;
            var emphasisColor = this.getItemStyleColor(emphasis.color, seriesIndex, dataIndex, data) || (typeof normalColor === 'string' ? zrColor.lift(normalColor, -0.2) : normalColor);
            var xLB;
            switch (align) {
            case 'left':
                xLB = xLT;
                break;
            case 'right':
                xLB = xLT + (topWidth - bottomWidth);
                break;
            default:
                xLB = xLT + (topWidth - bottomWidth) / 2;
                break;
            }
            var polygon = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                clickable: this.deepQuery(queryTarget, 'clickable'),
                style: {
                    pointList: [
                        [
                            xLT,
                            y
                        ],
                        [
                            xLT + topWidth,
                            y
                        ],
                        [
                            xLB + bottomWidth,
                            y + height
                        ],
                        [
                            xLB,
                            y + height
                        ]
                    ],
                    brushType: 'both',
                    color: normalColor,
                    lineWidth: normal.borderWidth,
                    strokeColor: normal.borderColor
                },
                highlightStyle: {
                    color: emphasisColor,
                    lineWidth: emphasis.borderWidth,
                    strokeColor: emphasis.borderColor
                }
            };
            if (this.deepQuery([
                    data,
                    serie,
                    this.option
                ], 'calculable')) {
                this.setCalculable(polygon);
                polygon.draggable = true;
            }
            return new PolygonShape(polygon);
        },
        getLabel: function (seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align) {
            var serie = this.series[seriesIndex];
            var data = serie.data[dataIndex];
            var location = this._paramsMap[seriesIndex].location;
            var itemStyle = zrUtil.merge(zrUtil.clone(data.itemStyle) || {}, serie.itemStyle);
            var status = 'normal';
            var labelControl = itemStyle[status].label;
            var textStyle = labelControl.textStyle || {};
            var lineLength = itemStyle[status].labelLine.length;
            var text = this.getLabelText(seriesIndex, dataIndex, status);
            var textFont = this.getFont(textStyle);
            var textAlign;
            var textColor = defaultColor;
            labelControl.position = labelControl.position || itemStyle.normal.label.position;
            if (labelControl.position === 'inner' || labelControl.position === 'inside' || labelControl.position === 'center') {
                textAlign = align;
                textColor = Math.max(topWidth, bottomWidth) / 2 > zrArea.getTextWidth(text, textFont) ? '#fff' : zrColor.reverse(defaultColor);
            } else if (labelControl.position === 'left') {
                textAlign = 'right';
            } else {
                textAlign = 'left';
            }
            var textShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                style: {
                    x: this._getLabelPoint(labelControl.position, x, location, topWidth, bottomWidth, lineLength, align),
                    y: y + height / 2,
                    color: textStyle.color || textColor,
                    text: text,
                    textAlign: textStyle.align || textAlign,
                    textBaseline: textStyle.baseline || 'middle',
                    textFont: textFont
                }
            };
            status = 'emphasis';
            labelControl = itemStyle[status].label || labelControl;
            textStyle = labelControl.textStyle || textStyle;
            lineLength = itemStyle[status].labelLine.length || lineLength;
            labelControl.position = labelControl.position || itemStyle.normal.label.position;
            text = this.getLabelText(seriesIndex, dataIndex, status);
            textFont = this.getFont(textStyle);
            textColor = defaultColor;
            if (labelControl.position === 'inner' || labelControl.position === 'inside' || labelControl.position === 'center') {
                textAlign = align;
                textColor = Math.max(topWidth, bottomWidth) / 2 > zrArea.getTextWidth(text, textFont) ? '#fff' : zrColor.reverse(defaultColor);
            } else if (labelControl.position === 'left') {
                textAlign = 'right';
            } else {
                textAlign = 'left';
            }
            textShape.highlightStyle = {
                x: this._getLabelPoint(labelControl.position, x, location, topWidth, bottomWidth, lineLength, align),
                color: textStyle.color || textColor,
                text: text,
                textAlign: textStyle.align || textAlign,
                textFont: textFont,
                brushType: 'fill'
            };
            return new TextShape(textShape);
        },
        getLabelText: function (seriesIndex, dataIndex, status) {
            var series = this.series;
            var serie = series[seriesIndex];
            var data = serie.data[dataIndex];
            var formatter = this.deepQuery([
                data,
                serie
            ], 'itemStyle.' + status + '.label.formatter');
            if (formatter) {
                if (typeof formatter === 'function') {
                    return formatter.call(this.myChart, {
                        seriesIndex: seriesIndex,
                        seriesName: serie.name || '',
                        series: serie,
                        dataIndex: dataIndex,
                        data: data,
                        name: data.name,
                        value: data.value
                    });
                } else if (typeof formatter === 'string') {
                    formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}').replace('{c}', '{c0}').replace('{a0}', serie.name).replace('{b0}', data.name).replace('{c0}', data.value);
                    return formatter;
                }
            } else {
                return data.name;
            }
        },
        getLabelLine: function (seriesIndex, dataIndex, defaultColor, x, y, topWidth, bottomWidth, height, align) {
            var serie = this.series[seriesIndex];
            var data = serie.data[dataIndex];
            var location = this._paramsMap[seriesIndex].location;
            var itemStyle = zrUtil.merge(zrUtil.clone(data.itemStyle) || {}, serie.itemStyle);
            var status = 'normal';
            var labelLineControl = itemStyle[status].labelLine;
            var lineLength = itemStyle[status].labelLine.length;
            var lineStyle = labelLineControl.lineStyle || {};
            var labelControl = itemStyle[status].label;
            labelControl.position = labelControl.position || itemStyle.normal.label.position;
            var lineShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                hoverable: false,
                style: {
                    xStart: this._getLabelLineStartPoint(x, location, topWidth, bottomWidth, align),
                    yStart: y + height / 2,
                    xEnd: this._getLabelPoint(labelControl.position, x, location, topWidth, bottomWidth, lineLength, align),
                    yEnd: y + height / 2,
                    strokeColor: lineStyle.color || defaultColor,
                    lineType: lineStyle.type,
                    lineWidth: lineStyle.width
                }
            };
            status = 'emphasis';
            labelLineControl = itemStyle[status].labelLine || labelLineControl;
            lineLength = itemStyle[status].labelLine.length || lineLength;
            lineStyle = labelLineControl.lineStyle || lineStyle;
            labelControl = itemStyle[status].label || labelControl;
            labelControl.position = labelControl.position;
            lineShape.highlightStyle = {
                xEnd: this._getLabelPoint(labelControl.position, x, location, topWidth, bottomWidth, lineLength, align),
                strokeColor: lineStyle.color || defaultColor,
                lineType: lineStyle.type,
                lineWidth: lineStyle.width
            };
            return new LineShape(lineShape);
        },
        _getLabelPoint: function (position, x, location, topWidth, bottomWidth, lineLength, align) {
            position = position === 'inner' || position === 'inside' ? 'center' : position;
            switch (position) {
            case 'center':
                return align == 'center' ? x + topWidth / 2 : align == 'left' ? x + 10 : x + topWidth - 10;
            case 'left':
                if (lineLength === 'auto') {
                    return location.x - 10;
                } else {
                    return align == 'center' ? location.centerX - Math.max(topWidth, bottomWidth) / 2 - lineLength : align == 'right' ? x - (topWidth < bottomWidth ? bottomWidth - topWidth : 0) - lineLength : location.x - lineLength;
                }
                break;
            default:
                if (lineLength === 'auto') {
                    return location.x + location.width + 10;
                } else {
                    return align == 'center' ? location.centerX + Math.max(topWidth, bottomWidth) / 2 + lineLength : align == 'right' ? location.x + location.width + lineLength : x + Math.max(topWidth, bottomWidth) + lineLength;
                }
            }
        },
        _getLabelLineStartPoint: function (x, location, topWidth, bottomWidth, align) {
            return align == 'center' ? location.centerX : topWidth < bottomWidth ? x + Math.min(topWidth, bottomWidth) / 2 : x + Math.max(topWidth, bottomWidth) / 2;
        },
        _needLabel: function (serie, data, isEmphasis) {
            return this.deepQuery([
                data,
                serie
            ], 'itemStyle.' + (isEmphasis ? 'emphasis' : 'normal') + '.label.show');
        },
        _needLabelLine: function (serie, data, isEmphasis) {
            return this.deepQuery([
                data,
                serie
            ], 'itemStyle.' + (isEmphasis ? 'emphasis' : 'normal') + '.labelLine.show');
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }
            this.backupShapeList();
            this._buildShape();
        }
    };
    zrUtil.inherits(Funnel, ChartBase);
    require('../chart').define('funnel', Funnel);
    return Funnel;
});define('echarts/chart/eventRiver', [
    'require',
    './base',
    '../layout/eventRiver',
    'zrender/shape/Polygon',
    '../component/axis',
    '../component/grid',
    '../component/dataZoom',
    '../config',
    '../util/ecData',
    '../util/date',
    'zrender/tool/util',
    'zrender/tool/color',
    '../chart'
], function (require) {
    var ChartBase = require('./base');
    var eventRiverLayout = require('../layout/eventRiver');
    var PolygonShape = require('zrender/shape/Polygon');
    require('../component/axis');
    require('../component/grid');
    require('../component/dataZoom');
    var ecConfig = require('../config');
    ecConfig.eventRiver = {
        zlevel: 0,
        z: 2,
        clickable: true,
        legendHoverLink: true,
        itemStyle: {
            normal: {
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}'
                }
            },
            emphasis: {
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                label: { show: true }
            }
        }
    };
    var ecData = require('../util/ecData');
    var ecDate = require('../util/date');
    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');
    function EventRiver(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        var self = this;
        self._ondragend = function () {
            self.isDragend = true;
        };
        this.refresh(option);
    }
    EventRiver.prototype = {
        type: ecConfig.CHART_TYPE_EVENTRIVER,
        _buildShape: function () {
            var series = this.series;
            this.selectedMap = {};
            this._dataPreprocessing();
            var legend = this.component.legend;
            var eventRiverSeries = [];
            for (var i = 0; i < series.length; i++) {
                if (series[i].type === this.type) {
                    series[i] = this.reformOption(series[i]);
                    this.legendHoverLink = series[i].legendHoverLink || this.legendHoverLink;
                    var serieName = series[i].name || '';
                    this.selectedMap[serieName] = legend ? legend.isSelected(serieName) : true;
                    if (!this.selectedMap[serieName]) {
                        continue;
                    }
                    this.buildMark(i);
                    eventRiverSeries.push(this.series[i]);
                }
            }
            eventRiverLayout(eventRiverSeries, this._intervalX, this.component.grid.getArea());
            this._drawEventRiver();
            this.addShapeList();
        },
        _dataPreprocessing: function () {
            var series = this.series;
            var xAxis;
            var evolutionList;
            for (var i = 0, iLen = series.length; i < iLen; i++) {
                if (series[i].type === this.type) {
                    xAxis = this.component.xAxis.getAxis(series[i].xAxisIndex || 0);
                    for (var j = 0, jLen = series[i].data.length; j < jLen; j++) {
                        evolutionList = series[i].data[j].evolution;
                        for (var k = 0, kLen = evolutionList.length; k < kLen; k++) {
                            evolutionList[k].timeScale = xAxis.getCoord(ecDate.getNewDate(evolutionList[k].time) - 0);
                            evolutionList[k].valueScale = Math.pow(evolutionList[k].value, 0.8);
                        }
                    }
                }
            }
            this._intervalX = Math.round(this.component.grid.getWidth() / 40);
        },
        _drawEventRiver: function () {
            var series = this.series;
            for (var i = 0; i < series.length; i++) {
                var serieName = series[i].name || '';
                if (series[i].type === this.type && this.selectedMap[serieName]) {
                    for (var j = 0; j < series[i].data.length; j++) {
                        this._drawEventBubble(series[i].data[j], i, j);
                    }
                }
            }
        },
        _drawEventBubble: function (oneEvent, seriesIndex, dataIndex) {
            var series = this.series;
            var serie = series[seriesIndex];
            var serieName = serie.name || '';
            var data = serie.data[dataIndex];
            var queryTarget = [
                data,
                serie
            ];
            var legend = this.component.legend;
            var defaultColor = legend ? legend.getColor(serieName) : this.zr.getColor(seriesIndex);
            var normal = this.deepMerge(queryTarget, 'itemStyle.normal') || {};
            var emphasis = this.deepMerge(queryTarget, 'itemStyle.emphasis') || {};
            var normalColor = this.getItemStyleColor(normal.color, seriesIndex, dataIndex, data) || defaultColor;
            var emphasisColor = this.getItemStyleColor(emphasis.color, seriesIndex, dataIndex, data) || (typeof normalColor === 'string' ? zrColor.lift(normalColor, -0.2) : normalColor);
            var pts = this._calculateControlPoints(oneEvent);
            var eventBubbleShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                clickable: this.deepQuery(queryTarget, 'clickable'),
                style: {
                    pointList: pts,
                    smooth: 'spline',
                    brushType: 'both',
                    lineJoin: 'round',
                    color: normalColor,
                    lineWidth: normal.borderWidth,
                    strokeColor: normal.borderColor
                },
                highlightStyle: {
                    color: emphasisColor,
                    lineWidth: emphasis.borderWidth,
                    strokeColor: emphasis.borderColor
                },
                draggable: 'vertical',
                ondragend: this._ondragend
            };
            eventBubbleShape = new PolygonShape(eventBubbleShape);
            this.addLabel(eventBubbleShape, serie, data, oneEvent.name);
            ecData.pack(eventBubbleShape, series[seriesIndex], seriesIndex, series[seriesIndex].data[dataIndex], dataIndex, series[seriesIndex].data[dataIndex].name);
            this.shapeList.push(eventBubbleShape);
        },
        _calculateControlPoints: function (oneEvent) {
            var intervalX = this._intervalX;
            var posY = oneEvent.y;
            var evolution = oneEvent.evolution;
            var n = evolution.length;
            if (n < 1) {
                return;
            }
            var time = [];
            var value = [];
            for (var i = 0; i < n; i++) {
                time.push(evolution[i].timeScale);
                value.push(evolution[i].valueScale);
            }
            var pts = [];
            pts.push([
                time[0],
                posY
            ]);
            var i = 0;
            for (i = 0; i < n - 1; i++) {
                pts.push([
                    (time[i] + time[i + 1]) / 2,
                    value[i] / -2 + posY
                ]);
            }
            pts.push([
                (time[i] + (time[i] + intervalX)) / 2,
                value[i] / -2 + posY
            ]);
            pts.push([
                time[i] + intervalX,
                posY
            ]);
            pts.push([
                (time[i] + (time[i] + intervalX)) / 2,
                value[i] / 2 + posY
            ]);
            for (i = n - 1; i > 0; i--) {
                pts.push([
                    (time[i] + time[i - 1]) / 2,
                    value[i - 1] / 2 + posY
                ]);
            }
            return pts;
        },
        ondragend: function (param, status) {
            if (!this.isDragend || !param.target) {
                return;
            }
            status.dragOut = true;
            status.dragIn = true;
            status.needRefresh = false;
            this.isDragend = false;
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }
            this.backupShapeList();
            this._buildShape();
        }
    };
    zrUtil.inherits(EventRiver, ChartBase);
    require('../chart').define('eventRiver', EventRiver);
    return EventRiver;
});define('echarts/layout/eventRiver', ['require'], function (require) {
    function eventRiverLayout(series, intervalX, area) {
        var space = 5;
        var scale = intervalX;
        function importanceSort(a, b) {
            var x = a.importance;
            var y = b.importance;
            return x > y ? -1 : x < y ? 1 : 0;
        }
        function indexOf(array, value) {
            if (array.indexOf) {
                return array.indexOf(value);
            }
            for (var i = 0, len = array.length; i < len; i++) {
                if (array[i] === value) {
                    return i;
                }
            }
            return -1;
        }
        for (var i = 0; i < series.length; i++) {
            for (var j = 0; j < series[i].data.length; j++) {
                if (series[i].data[j].weight == null) {
                    series[i].data[j].weight = 1;
                }
                var importance = 0;
                for (var k = 0; k < series[i].data[j].evolution.length; k++) {
                    importance += series[i].data[j].evolution[k].valueScale;
                }
                series[i].data[j].importance = importance * series[i].data[j].weight;
            }
            series[i].data.sort(importanceSort);
        }
        for (var i = 0; i < series.length; i++) {
            if (series[i].weight == null) {
                series[i].weight = 1;
            }
            var importance = 0;
            for (var j = 0; j < series[i].data.length; j++) {
                importance += series[i].data[j].weight;
            }
            series[i].importance = importance * series[i].weight;
        }
        series.sort(importanceSort);
        var minTime = Number.MAX_VALUE;
        var maxTime = 0;
        for (var i = 0; i < series.length; i++) {
            for (var j = 0; j < series[i].data.length; j++) {
                for (var k = 0; k < series[i].data[j].evolution.length; k++) {
                    var time = series[i].data[j].evolution[k].timeScale;
                    minTime = Math.min(minTime, time);
                    maxTime = Math.max(maxTime, time);
                }
            }
        }
        var root = segmentTreeBuild(Math.floor(minTime), Math.ceil(maxTime));
        var totalMaxY = 0;
        for (var i = 0; i < series.length; i++) {
            for (var j = 0; j < series[i].data.length; j++) {
                var e = series[i].data[j];
                e.time = [];
                e.value = [];
                for (var k = 0; k < series[i].data[j].evolution.length; k++) {
                    e.time.push(series[i].data[j].evolution[k].timeScale);
                    e.value.push(series[i].data[j].evolution[k].valueScale);
                }
                var mxIndex = indexOf(e.value, Math.max.apply(Math, e.value));
                var maxY = segmentTreeQuery(root, e.time[mxIndex], e.time[mxIndex + 1]);
                var k = 0;
                e.y = maxY + e.value[mxIndex] / 2 + space;
                for (k = 0; k < e.time.length - 1; k++) {
                    var curMaxY = segmentTreeQuery(root, e.time[k], e.time[k + 1]);
                    if (e.y - e.value[k] / 2 - space < curMaxY) {
                        e.y = curMaxY + e.value[k] / 2 + space;
                    }
                }
                var curMaxY = segmentTreeQuery(root, e.time[k], e.time[k] + scale);
                if (e.y - e.value[k] / 2 - space < curMaxY) {
                    e.y = curMaxY + e.value[k] / 2 + space;
                }
                series[i].y = e.y;
                totalMaxY = Math.max(totalMaxY, e.y + e.value[mxIndex] / 2);
                for (k = 0; k < e.time.length - 1; k++) {
                    segmentTreeInsert(root, e.time[k], e.time[k + 1], e.y + e.value[k] / 2);
                }
                segmentTreeInsert(root, e.time[k], e.time[k] + scale, e.y + e.value[k] / 2);
            }
        }
        scaleY(series, area, totalMaxY, space);
    }
    function scaleY(series, area, maxY, space) {
        var yBase = area.y;
        var yScale = (area.height - space) / maxY;
        for (var i = 0; i < series.length; i++) {
            series[i].y = series[i].y * yScale + yBase;
            var eventList = series[i].data;
            for (var j = 0; j < eventList.length; j++) {
                eventList[j].y = eventList[j].y * yScale + yBase;
                var evolutionList = eventList[j].evolution;
                for (var k = 0; k < evolutionList.length; k++) {
                    evolutionList[k].valueScale *= yScale * 1;
                }
            }
        }
    }
    function segmentTreeBuild(left, right) {
        var root = {
            'left': left,
            'right': right,
            'leftChild': null,
            'rightChild': null,
            'maxValue': 0
        };
        if (left + 1 < right) {
            var mid = Math.round((left + right) / 2);
            root.leftChild = segmentTreeBuild(left, mid);
            root.rightChild = segmentTreeBuild(mid, right);
        }
        return root;
    }
    function segmentTreeQuery(root, left, right) {
        if (right - left < 1) {
            return 0;
        }
        var mid = Math.round((root.left + root.right) / 2);
        var result = 0;
        if (left == root.left && right == root.right) {
            result = root.maxValue;
        } else if (right <= mid && root.leftChild != null) {
            result = segmentTreeQuery(root.leftChild, left, right);
        } else if (left >= mid && root.rightChild != null) {
            result = segmentTreeQuery(root.rightChild, left, right);
        } else {
            var leftValue = 0;
            var rightValue = 0;
            if (root.leftChild != null) {
                leftValue = segmentTreeQuery(root.leftChild, left, mid);
            }
            if (root.rightChild != null) {
                rightValue = segmentTreeQuery(root.rightChild, mid, right);
            }
            result = leftValue > rightValue ? leftValue : rightValue;
        }
        return result;
    }
    function segmentTreeInsert(root, left, right, value) {
        if (root == null) {
            return;
        }
        var mid = Math.round((root.left + root.right) / 2);
        root.maxValue = root.maxValue > value ? root.maxValue : value;
        if (Math.floor(left * 10) == Math.floor(root.left * 10) && Math.floor(right * 10) == Math.floor(root.right * 10)) {
            return;
        } else if (right <= mid) {
            segmentTreeInsert(root.leftChild, left, right, value);
        } else if (left >= mid) {
            segmentTreeInsert(root.rightChild, left, right, value);
        } else {
            segmentTreeInsert(root.leftChild, left, mid, value);
            segmentTreeInsert(root.rightChild, mid, right, value);
        }
    }
    return eventRiverLayout;
});
var zrender = require('zrender');
zrender.tool = {
    color : require('zrender/tool/color'),
    math : require('zrender/tool/math'),
    util : require('zrender/tool/util'),
    vector : require('zrender/tool/vector'),
    area : require('zrender/tool/area'),
    event : require('zrender/tool/event')
}

zrender.animation = {
    Animation : require('zrender/animation/Animation'),
    Cip : require('zrender/animation/Clip'),
    easing : require('zrender/animation/easing')
}
var echarts = require('echarts');
echarts.config = require('echarts/config');

echarts.util = {
    mapData : {
        params : require('echarts/util/mapData/params')
    }
}


require("echarts/chart/line");

require("echarts/chart/bar");

require("echarts/chart/scatter");

require("echarts/chart/k");

require("echarts/chart/pie");

require("echarts/chart/radar");

require("echarts/chart/chord");

require("echarts/chart/force");

require("echarts/chart/map");

require("echarts/chart/gauge");

require("echarts/chart/funnel");

require("echarts/chart/eventRiver");

_global['echarts'] = echarts;
_global['zrender'] = zrender;

})(window);