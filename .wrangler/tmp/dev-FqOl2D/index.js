var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// .wrangler/tmp/bundle-lVxDam/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/_internal/utils.mjs
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
__name(PerformanceEntry, "PerformanceEntry");
var PerformanceMark = /* @__PURE__ */ __name(class PerformanceMark2 extends PerformanceEntry {
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
}, "PerformanceMark");
var PerformanceMeasure = class extends PerformanceEntry {
  entryType = "measure";
};
__name(PerformanceMeasure, "PerformanceMeasure");
var PerformanceResourceTiming = class extends PerformanceEntry {
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
__name(PerformanceResourceTiming, "PerformanceResourceTiming");
var PerformanceObserverEntryList = class {
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
__name(PerformanceObserverEntryList, "PerformanceObserverEntryList");
var Performance = class {
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
__name(Performance, "Performance");
var PerformanceObserver = class {
  __unenv__ = true;
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
__name(PerformanceObserver, "PerformanceObserver");
__publicField(PerformanceObserver, "supportedEntryTypes", []);
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
import { Socket } from "node:net";
var ReadStream = class extends Socket {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  isRaw = false;
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
  isTTY = false;
};
__name(ReadStream, "ReadStream");

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
import { Socket as Socket2 } from "node:net";
var WriteStream = class extends Socket2 {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  columns = 80;
  rows = 24;
  isTTY = false;
};
__name(WriteStream, "WriteStream");

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class extends EventEmitter {
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return "";
  }
  get versions() {
    return {};
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  ref() {
  }
  unref() {
  }
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: () => 0 });
  mainModule = void 0;
  domain = void 0;
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};
__name(Process, "Process");

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var { exit, platform, nextTick } = getBuiltinModule(
  "node:process"
);
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  nextTick
});
var {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  finalization,
  features,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  on,
  off,
  once,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/security.js
var BLOCKED_DIRS = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  "__pycache__",
  "dist",
  "build",
  ".next",
  ".venv",
  "data",
  ".firebase",
  ".qwen",
  ".wrangler",
  "coverage",
  ".turbo"
]);
var BLOCKED_BASENAMES = /* @__PURE__ */ new Set([
  ".DS_Store",
  "Thumbs.db",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
  "service-account.json"
]);
var BLOCKED_EXTS = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"];
function isBlocked(relPath) {
  if (!relPath)
    return true;
  const clean = relPath.replace(/\\/g, "/");
  const parts = clean.split("/").filter(Boolean);
  if (parts.some((p) => BLOCKED_DIRS.has(p)))
    return true;
  if (parts.some((p) => BLOCKED_BASENAMES.has(p)))
    return true;
  if (parts.some((p) => BLOCKED_EXTS.some((ext) => p.endsWith(ext))))
    return true;
  if (parts.some((p) => p === ".env" || p.startsWith(".env.") && p !== ".env.example"))
    return true;
  return false;
}
__name(isBlocked, "isBlocked");
function safeRelPath(p) {
  if (!p)
    return null;
  const clean = p.replace(/\\/g, "/");
  if (clean.split("/").includes("..") || clean.startsWith("/"))
    return null;
  const segs = [];
  for (const s of clean.split("/")) {
    if (s === "..")
      return null;
    if (s !== "." && s !== "")
      segs.push(s);
  }
  const out = segs.join("/");
  if (!out)
    return null;
  if (isBlocked(out))
    return null;
  return out;
}
__name(safeRelPath, "safeRelPath");
function safeProj(proj) {
  if (!proj)
    return null;
  if (proj.includes("/") || proj.includes("\\") || proj.includes(".."))
    return null;
  const trimmed = proj.trim();
  if (!trimmed || trimmed === ".")
    return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(trimmed))
    return null;
  return trimmed;
}
__name(safeProj, "safeProj");
function normalizeUploadPath(raw, proj) {
  const safe = safeRelPath(raw);
  if (!safe)
    return null;
  const parts = safe.split("/");
  if (parts.length > 1 && parts[0].toLowerCase() === proj.toLowerCase()) {
    return safeRelPath(parts.slice(1).join("/"));
  }
  return safe;
}
__name(normalizeUploadPath, "normalizeUploadPath");
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function sha256Bytes(bytes) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Bytes, "sha256Bytes");

// src/storage.js
async function listProjectFiles(FILES, user, proj) {
  const prefix = `projects/${user}/${proj}/`;
  let list = await FILES.list({ prefix });
  let objects = [...list.objects];
  while (list.truncated) {
    list = await FILES.list({ prefix, cursor: list.cursor });
    objects.push(...list.objects);
  }
  return objects.map((obj) => obj.key.replace(prefix, "")).filter((path) => path && !isBlocked(path)).sort();
}
__name(listProjectFiles, "listProjectFiles");
async function getFileMeta(FILES, key) {
  const object = await FILES.head(key);
  if (!object)
    return null;
  return {
    size: object.size,
    sha256: object.customMetadata?.sha256 || null
  };
}
__name(getFileMeta, "getFileMeta");
async function putFile(FILES, key, bytes, customMetadata = {}) {
  await FILES.put(key, bytes, { customMetadata });
}
__name(putFile, "putFile");

// src/index.js
var USER = "andie";
var DUMP_MAX_FILES = 200;
var DUMP_MAX_FILE_SIZE = 512 * 1024;
var DUMP_MAX_TOTAL = 8 * 1024 * 1024;
var MIME_MAP = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  jsx: "text/plain; charset=utf-8",
  py: "text/x-python; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/plain; charset=utf-8",
  css: "text/css; charset=utf-8",
  toml: "text/plain; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  rules: "text/plain; charset=utf-8",
  firebaserc: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp"
};
function guessContentType(filePath) {
  const base = filePath.split("/").pop() || filePath;
  if (base === ".firebaserc" || base === ".npmrc")
    return "application/json; charset=utf-8";
  if (base === ".gitignore" || base === ".gitattributes" || base === ".editorconfig" || base === "_redirects") {
    return "text/plain; charset=utf-8";
  }
  const ext = (base.includes(".") ? base.split(".").pop() : "").toLowerCase();
  return MIME_MAP[ext] || "text/plain; charset=utf-8";
}
__name(guessContentType, "guessContentType");
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
__name(escapeHtml, "escapeHtml");
function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const colors = {
    js: "#f1e05a",
    ts: "#3178c6",
    html: "#e34c26",
    css: "#563d7c",
    md: "#4f46e5",
    json: "#e88800",
    py: "#3572A5",
    png: "#10b981",
    jpg: "#10b981",
    jpeg: "#10b981",
    gif: "#10b981",
    svg: "#06b6d4"
  };
  const color = colors[ext] || "#9ca3af";
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
}
__name(getFileIcon, "getFileIcon");
function wantsJson(request, searchParams) {
  const format = (searchParams.get("format") || "").toLowerCase();
  if (format === "json" || format === "api")
    return true;
  if (searchParams.get("json") === "1" || searchParams.get("json") === "true")
    return true;
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  if (accept.includes("application/json"))
    return true;
  const ua = (request.headers.get("User-Agent") || "").toLowerCase();
  if (ua.includes("curl/") || ua.includes("python-requests") || ua.includes("httpx") || ua.includes("go-http-client")) {
    return true;
  }
  return false;
}
__name(wantsJson, "wantsJson");
function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function timingSafeEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function checkAuth(request, env2) {
  const token = env2.TINYHUB_TOKEN;
  if (!token)
    return false;
  const authHeader = request.headers.get("Authorization") || "";
  const expectedAuth = `Bearer ${token}`;
  return timingSafeEqual(authHeader, expectedAuth);
}
__name(checkAuth, "checkAuth");
function buildStructuredTree(paths, sizes = {}) {
  const dirSet = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const segs = p.split("/");
    for (let i = 1; i < segs.length; i++) {
      dirSet.add(segs.slice(0, i).join("/"));
    }
  }
  const tree = [
    ...[...dirSet].sort().map((path) => ({ path, type: "tree" })),
    ...paths.slice().sort().map((path) => ({ path, type: "blob", size: sizes[path] ?? null }))
  ];
  return { paths, tree };
}
__name(buildStructuredTree, "buildStructuredTree");
var src_default = {
  async fetch(request, env2) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    const { searchParams } = url;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const method = request.method === "HEAD" ? "GET" : request.method;
    try {
      if (method === "GET" && pathname === "/api/config") {
        return jsonResponse({ apiBase: "" }, 200, corsHeaders);
      }
      if (method === "GET" && pathname === "/api/projects") {
        const { results } = await env2.DB.prepare(
          "SELECT proj, updated_at, files_count, commits_count FROM projects WHERE user = ? ORDER BY updated_at DESC"
        ).bind(USER).all();
        const list = results.map((row) => ({
          name: row.proj,
          updatedAt: row.updated_at,
          filesCount: row.files_count,
          commitsCount: row.commits_count
        }));
        return jsonResponse(list, 200, corsHeaders);
      }
      if (method === "GET" && pathname.startsWith("/api/tree/")) {
        const proj = safeProj(pathname.substring("/api/tree/".length));
        if (!proj)
          return new Response("Invalid project name", { status: 400, headers: corsHeaders });
        const paths = await listProjectFiles(env2.FILES, USER, proj);
        const wantMeta = searchParams.get("meta") === "1" || searchParams.get("meta") === "true";
        const wantFlat = searchParams.get("flat") === "1" || searchParams.get("flat") === "true";
        if (wantFlat) {
          return jsonResponse(paths, 200, corsHeaders);
        }
        const fileList = [];
        const sizes = {};
        if (wantMeta) {
          for (const path of paths) {
            const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${path}`);
            fileList.push({
              path,
              size: meta?.size || 0,
              sha256: meta?.sha256 || null
            });
          }
          return jsonResponse({
            repo: `${USER}/${proj}`,
            project: proj,
            commit: null,
            files: fileList,
            count: fileList.length
          }, 200, corsHeaders);
        }
        for (const path of paths) {
          const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${path}`);
          sizes[path] = meta?.size || 0;
        }
        const { tree } = buildStructuredTree(paths, sizes);
        return jsonResponse({
          repo: `${USER}/${proj}`,
          project: proj,
          files: paths,
          tree,
          count: paths.length
        }, 200, corsHeaders);
      }
      if (method === "GET" && pathname.startsWith("/api/history/")) {
        const proj = safeProj(pathname.substring("/api/history/".length));
        if (!proj)
          return new Response("Invalid project name", { status: 400, headers: corsHeaders });
        const { results: commits } = await env2.DB.prepare(
          "SELECT id, hash12, author, message, stats_json, created_at FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 50"
        ).bind(USER, proj).all();
        const history = [];
        for (const c of commits) {
          const { results: files } = await env2.DB.prepare(
            "SELECT path, change_type FROM commit_files WHERE commit_id = ?"
          ).bind(c.id).all();
          const changes = { added: [], modified: [], deleted: [] };
          for (const f of files) {
            if (f.change_type === "added")
              changes.added.push(f.path);
            else if (f.change_type === "modified")
              changes.modified.push(f.path);
            else if (f.change_type === "deleted")
              changes.deleted.push(f.path);
          }
          history.push({
            hash: c.hash12,
            author: c.author,
            date: new Date(c.created_at * 1e3).toISOString(),
            message: c.message,
            stats: JSON.parse(c.stats_json),
            changes
          });
        }
        return jsonResponse(history, 200, corsHeaders);
      }
      if (method === "POST" && pathname.startsWith("/api/upload/")) {
        const proj = safeProj(pathname.substring("/api/upload/".length));
        if (!proj)
          return new Response("Invalid project name", { status: 400, headers: corsHeaders });
        const formData = await request.formData();
        let mode = (formData.get("mode") || "push").toString().toLowerCase();
        if (!["push", "merge", "replace"].includes(mode))
          mode = "push";
        let message = (formData.get("message") || "").toString().trim();
        const tNew = /* @__PURE__ */ new Map();
        const blocked = [];
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            const normPath = normalizeUploadPath(value.name, proj);
            if (!normPath)
              continue;
            if (isBlocked(normPath)) {
              blocked.push(normPath);
              continue;
            }
            if (value.size > 10 * 1024 * 1024)
              continue;
            const buf = await value.arrayBuffer();
            tNew.set(normPath, new Uint8Array(buf));
          }
        }
        if (tNew.size === 0 && mode !== "push") {
          return new Response("No files uploaded", { status: 400, headers: corsHeaders });
        }
        if (mode === "replace") {
          const oldPaths = await listProjectFiles(env2.FILES, USER, proj);
          for (const p of oldPaths) {
            await env2.FILES.delete(`projects/${USER}/${proj}/${p}`);
          }
        }
        const currentPaths = mode === "replace" ? [] : await listProjectFiles(env2.FILES, USER, proj);
        const oldHashes = /* @__PURE__ */ new Map();
        for (const p of currentPaths) {
          const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${p}`);
          if (meta)
            oldHashes.set(p, meta.sha256);
        }
        const added = [];
        const modified = [];
        const deleted = [];
        const saved = [];
        for (const [path, bytes] of tNew.entries()) {
          const sha = await sha256Bytes(bytes);
          const oldSha = oldHashes.get(path);
          if (!oldSha) {
            added.push(path);
          } else if (oldSha !== sha) {
            modified.push(path);
          }
          await putFile(env2.FILES, `projects/${USER}/${proj}/${path}`, bytes, { sha256: sha });
          saved.push(path);
        }
        if (mode === "push") {
          for (const p of currentPaths) {
            if (!tNew.has(p)) {
              await env2.FILES.delete(`projects/${USER}/${proj}/${p}`);
              deleted.push(p);
            }
          }
        }
        const totalFiles = (await listProjectFiles(env2.FILES, USER, proj)).length;
        const stats = {
          added: added.length,
          modified: modified.length,
          deleted: deleted.length,
          unchanged: totalFiles - added.length - modified.length
        };
        const commitId = crypto.randomUUID();
        const commitHash = (await sha256Hex(`${commitId}:${message}:${Date.now()}`)).substring(0, 12);
        const commitMsg = message || `Push: +${stats.added} ~${stats.modified} -${stats.deleted}`;
        await env2.DB.prepare(
          "INSERT INTO commits (id, user, proj, hash12, author, message, stats_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(commitId, USER, proj, commitHash, "Andie", commitMsg, JSON.stringify(stats), Math.floor(Date.now() / 1e3)).run();
        for (const p of added) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "added").run();
        }
        for (const p of modified) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "modified").run();
        }
        for (const p of deleted) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "deleted").run();
        }
        const commitsCountResult = await env2.DB.prepare(
          "SELECT COUNT(*) as count FROM commits WHERE user = ? AND proj = ?"
        ).bind(USER, proj).first();
        await env2.DB.prepare(
          "INSERT INTO projects (user, proj, updated_at, files_count, commits_count) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user, proj) DO UPDATE SET updated_at = excluded.updated_at, files_count = excluded.files_count, commits_count = excluded.commits_count"
        ).bind(USER, proj, Math.floor(Date.now() / 1e3), totalFiles, commitsCountResult.count).run();
        return jsonResponse({
          ok: true,
          project: proj,
          mode,
          blocked,
          saved,
          deleted,
          commit: {
            hash: commitHash,
            message: commitMsg,
            author: "Andie",
            stats,
            changes: { added, modified, deleted }
          },
          stats,
          changes: { added, modified, deleted }
        }, 200, corsHeaders);
      }
      if (method === "POST" && pathname.startsWith("/api/commit/")) {
        if (!checkAuth(request, env2))
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const proj = safeProj(pathname.substring("/api/commit/".length));
        if (!proj)
          return new Response("Invalid project name", { status: 400, headers: corsHeaders });
        const body = await request.json();
        const { message, files, deletes } = body || {};
        const currentPaths = await listProjectFiles(env2.FILES, USER, proj);
        const oldHashes = /* @__PURE__ */ new Map();
        for (const p of currentPaths) {
          const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${p}`);
          if (meta)
            oldHashes.set(p, meta.sha256);
        }
        const added = [];
        const modified = [];
        const deleted = [];
        const saved = [];
        for (const [path, content] of Object.entries(files || {})) {
          const safePath = safeRelPath(path);
          if (!safePath || isBlocked(safePath))
            continue;
          const bytes = new TextEncoder().encode(content);
          const sha = await sha256Bytes(bytes);
          const oldSha = oldHashes.get(safePath);
          if (!oldSha)
            added.push(safePath);
          else if (oldSha !== sha)
            modified.push(safePath);
          await putFile(env2.FILES, `projects/${USER}/${proj}/${safePath}`, bytes, { sha256: sha });
          saved.push(safePath);
        }
        for (const path of deletes || []) {
          const safePath = safeRelPath(path);
          if (!safePath || isBlocked(safePath))
            continue;
          await env2.FILES.delete(`projects/${USER}/${proj}/${safePath}`);
          deleted.push(safePath);
        }
        if (saved.length === 0 && deleted.length === 0) {
          return jsonResponse({ ok: true, empty: true, message: "Everything up-to-date", project: proj }, 200, corsHeaders);
        }
        const totalFiles = (await listProjectFiles(env2.FILES, USER, proj)).length;
        const stats = {
          added: added.length,
          modified: modified.length,
          deleted: deleted.length,
          unchanged: totalFiles - added.length - modified.length
        };
        const commitId = crypto.randomUUID();
        const commitHash = (await sha256Hex(`${commitId}:${message}:${Date.now()}`)).substring(0, 12);
        const commitMsg = message || `Update: +${stats.added} ~${stats.modified} -${stats.deleted}`;
        await env2.DB.prepare(
          "INSERT INTO commits (id, user, proj, hash12, author, message, stats_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(commitId, USER, proj, commitHash, "Meta AI", commitMsg, JSON.stringify(stats), Math.floor(Date.now() / 1e3)).run();
        for (const p of added) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "added").run();
        }
        for (const p of modified) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "modified").run();
        }
        for (const p of deleted) {
          await env2.DB.prepare("INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)").bind(commitId, p, "deleted").run();
        }
        const commitsCountResult = await env2.DB.prepare(
          "SELECT COUNT(*) as count FROM commits WHERE user = ? AND proj = ?"
        ).bind(USER, proj).first();
        await env2.DB.prepare(
          "INSERT INTO projects (user, proj, updated_at, files_count, commits_count) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user, proj) DO UPDATE SET updated_at = excluded.updated_at, files_count = excluded.files_count, commits_count = excluded.commits_count"
        ).bind(USER, proj, Math.floor(Date.now() / 1e3), totalFiles, commitsCountResult.count).run();
        return jsonResponse({
          ok: true,
          project: proj,
          commit: {
            hash: commitHash,
            message: commitMsg,
            author: "Meta AI",
            stats,
            changes: { added, modified, deleted }
          },
          stats,
          changes: { added, modified, deleted }
        }, 200, corsHeaders);
      }
      if (method === "POST" && pathname.startsWith("/api/reset/")) {
        if (!checkAuth(request, env2))
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const proj = safeProj(pathname.substring("/api/reset/".length));
        if (!proj)
          return new Response("Invalid project name", { status: 400, headers: corsHeaders });
        const paths = await listProjectFiles(env2.FILES, USER, proj);
        for (const p of paths) {
          await env2.FILES.delete(`projects/${USER}/${proj}/${p}`);
        }
        const commitsResult = await env2.DB.prepare("SELECT id FROM commits WHERE user = ? AND proj = ?").bind(USER, proj).all();
        for (const c of commitsResult.results) {
          await env2.DB.prepare("DELETE FROM commit_files WHERE commit_id = ?").bind(c.id).run();
        }
        await env2.DB.prepare("DELETE FROM commits WHERE user = ? AND proj = ?").bind(USER, proj).run();
        await env2.DB.prepare("DELETE FROM projects WHERE user = ? AND proj = ?").bind(USER, proj).run();
        return jsonResponse({ ok: true, project: proj, deleted: paths.length, message: `Wiped ${paths.length} files and D1 records` }, 200, corsHeaders);
      }
      if (method === "GET" && pathname.startsWith("/r/")) {
        const rest = pathname.substring("/r/".length);
        const segs = rest.split("/").filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);
        const filepath = safeRelPath(segs.slice(2).join("/"));
        if (user !== USER || !proj || !filepath || isBlocked(filepath)) {
          return new Response("Not Found", { status: 404, headers: corsHeaders });
        }
        const object = await env2.FILES.get(`projects/${USER}/${proj}/${filepath}`);
        if (!object)
          return new Response("Not Found", { status: 404, headers: corsHeaders });
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", guessContentType(filepath));
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return new Response(object.body, { headers });
      }
      if (method === "GET" && pathname.startsWith("/p/")) {
        const rest = pathname.substring("/p/".length);
        const segs = rest.split("/").filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);
        const filepath = safeRelPath(segs.slice(2).join("/")) || "";
        if (user !== USER || !proj) {
          return new Response("Not Found", { status: 404, headers: corsHeaders });
        }
        const templateRes = await env2.ASSETS.fetch(new Request(new URL("/browser-template.html", request.url)));
        if (!templateRes.ok)
          return new Response("Template not found", { status: 500 });
        let htmlContent = await templateRes.text();
        const paths = await listProjectFiles(env2.FILES, USER, proj);
        const buildNestedTree = /* @__PURE__ */ __name((items) => {
          const root = {};
          for (const f of items) {
            const parts = f.split("/");
            let curr = root;
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (i === parts.length - 1) {
                curr[part] = null;
              } else {
                if (!curr[part])
                  curr[part] = {};
                curr = curr[part];
              }
            }
          }
          return root;
        }, "buildNestedTree");
        const renderNestedTree = /* @__PURE__ */ __name((node, prefix = "") => {
          const keys = Object.keys(node);
          keys.sort((a, b) => {
            const aFolder = node[a] !== null;
            const bFolder = node[b] !== null;
            if (aFolder && !bFolder)
              return -1;
            if (!aFolder && bFolder)
              return 1;
            return a.localeCompare(b);
          });
          let out = "";
          for (const key of keys) {
            const isFolder = node[key] !== null;
            const currentPath = prefix ? `${prefix}/${key}` : key;
            if (isFolder) {
              const folderIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
              const children = renderNestedTree(node[key], currentPath);
              const depth = prefix.split("/").filter(Boolean).length;
              const openAttr = depth <= 1 ? " open" : "";
              out += `<details class="folder-container"${openAttr}><summary class="folder-summary">${folderIcon}<span>${escapeHtml(key)}</span></summary><div class="folder-children">${children}</div></details>`;
            } else {
              const icon = getFileIcon(key);
              const activeClass = currentPath === filepath ? " active" : "";
              out += `<a class="file-item${activeClass}" href="/p/${USER}/${proj}/${escapeHtml(currentPath)}" data-path="${escapeHtml(currentPath)}">${icon}<span>${escapeHtml(key)}</span></a>`;
            }
          }
          return out;
        }, "renderNestedTree");
        const nestedRoot = buildNestedTree(paths);
        const treeHtml = paths.length > 0 ? renderNestedTree(nestedRoot) : '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No files found.</div>';
        const { results: commits } = await env2.DB.prepare(
          "SELECT hash12, author, message FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 50"
        ).bind(USER, proj).all();
        const historyHtml = commits.length > 0 ? commits.map((c) => `<div class="commit-card"><b>${escapeHtml(c.hash12)}</b> ${escapeHtml(c.message)}<small>${escapeHtml(c.author)}</small></div>`).join("") : '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No commit history.</div>';
        let fileContentHtml = "";
        let breadcrumbsHtml = "Select a file to preview";
        let copyStyleHtml = 'style="display: none;"';
        let defaultEmptyStyleHtml = "";
        let previewStyleHtml = 'style="display: none;"';
        let markdownStyleHtml = 'style="display: none;"';
        let markdownContentHtml = "";
        let imageStyleHtml = 'style="display: none;"';
        let imageContentHtml = "";
        if (filepath) {
          const object = await env2.FILES.get(`projects/${USER}/${proj}/${filepath}`);
          if (object) {
            breadcrumbsHtml = `projects / ${escapeHtml(USER)} / ${escapeHtml(proj)} / <span>${escapeHtml(filepath)}</span>`;
            copyStyleHtml = 'style="display: block;"';
            defaultEmptyStyleHtml = 'style="display: none;"';
            const ext = filepath.split(".").pop().toLowerCase();
            if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) {
              const imageSrc = `/r/${USER}/${proj}/${filepath}`;
              imageContentHtml = `<img src="${imageSrc}" alt="${escapeHtml(filepath)}" style="max-width:100%; max-height:500px; border-radius:8px; box-shadow: var(--shadow-glass); background: var(--bg-glass-inset); padding:10px;">`;
              imageStyleHtml = 'style="display: flex;"';
            } else {
              const text = await object.text();
              fileContentHtml = escapeHtml(text);
              previewStyleHtml = 'style="display: block;"';
            }
          }
        }
        htmlContent = htmlContent.replace("<!-- SSR_TREE -->", treeHtml);
        htmlContent = htmlContent.replace("<!-- SSR_HISTORY -->", historyHtml);
        htmlContent = htmlContent.replace("<!-- SSR_BREADCRUMBS -->", breadcrumbsHtml);
        htmlContent = htmlContent.replace("<!-- SSR_COPY_STYLE -->", copyStyleHtml);
        htmlContent = htmlContent.replace("<!-- SSR_DEFAULT_EMPTY_STYLE -->", defaultEmptyStyleHtml);
        htmlContent = htmlContent.replace("<!-- SSR_PREVIEW_STYLE -->", previewStyleHtml);
        htmlContent = htmlContent.replace("<!-- SSR_FILE_CONTENT -->", fileContentHtml);
        htmlContent = htmlContent.replace("<!-- SSR_MARKDOWN_STYLE -->", markdownStyleHtml);
        htmlContent = htmlContent.replace("<!-- SSR_MARKDOWN_CONTENT -->", markdownContentHtml);
        htmlContent = htmlContent.replace("<!-- SSR_IMAGE_STYLE -->", imageStyleHtml);
        htmlContent = htmlContent.replace("<!-- SSR_IMAGE_CONTENT -->", imageContentHtml);
        return new Response(htmlContent, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        });
      }
      if (method === "GET" && pathname.startsWith("/dump/")) {
        const rest = pathname.substring("/dump/".length);
        const segs = rest.split("/").filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);
        if (user !== USER || !proj) {
          return new Response("Not Found", { status: 404, headers: corsHeaders });
        }
        const paths = await listProjectFiles(env2.FILES, USER, proj);
        if (wantsJson(request, searchParams)) {
          const files = {};
          const skipped2 = [];
          let totalBytes2 = 0;
          let fileCount2 = 0;
          const ALWAYS_INCLUDE2 = /* @__PURE__ */ new Set(["firebase.json", "firestore.rules", "storage.rules", "wrangler.toml", "firestore.indexes.json"]);
          for (const path of paths) {
            const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${path}`);
            const size = meta?.size || 0;
            if (fileCount2 >= DUMP_MAX_FILES && !ALWAYS_INCLUDE2.has(path)) {
              skipped2.push({ path, reason: "max_files" });
              continue;
            }
            if (size > DUMP_MAX_FILE_SIZE && !ALWAYS_INCLUDE2.has(path)) {
              skipped2.push({ path, reason: "too_large" });
              continue;
            }
            const object = await env2.FILES.get(`projects/${USER}/${proj}/${path}`);
            if (!object) {
              skipped2.push({ path, reason: "missing" });
              continue;
            }
            const buf = await object.arrayBuffer();
            if (totalBytes2 + buf.byteLength > DUMP_MAX_TOTAL && !ALWAYS_INCLUDE2.has(path)) {
              skipped2.push({ path, reason: "total_budget" });
              continue;
            }
            const bytes = new Uint8Array(buf);
            const ext = path.split(".").pop().toLowerCase();
            const binary = ["png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "gz", "woff", "woff2", "ttf", "eot", "mp3", "mp4", "wasm", "bin"].includes(ext) || bytes.includes(0);
            if (binary) {
              skipped2.push({ path, reason: "binary" });
              continue;
            }
            const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            files[path] = content;
            totalBytes2 += buf.byteLength;
            fileCount2++;
          }
          return jsonResponse({
            repo: `${USER}/${proj}`,
            type: "dump",
            fileCount: Object.keys(files).length,
            totalBytes: totalBytes2,
            files,
            skipped: skipped2,
            urls: {
              html: `/dump/${USER}/${proj}/`,
              browser: `/p/${USER}/${proj}/`
            }
          }, 200, corsHeaders);
        }
        const templateRes = await env2.ASSETS.fetch(new Request(new URL("/dump-template.html", request.url)));
        if (!templateRes.ok)
          return new Response("Dump template not found", { status: 500 });
        let tmpl = await templateRes.text();
        let sectionsHtml = "";
        let fileCount = 0;
        let totalBytes = 0;
        const skipped = [];
        const ALWAYS_INCLUDE = /* @__PURE__ */ new Set(["firebase.json", "firestore.rules", "storage.rules", "wrangler.toml", "firestore.indexes.json"]);
        for (const path of paths) {
          const meta = await getFileMeta(env2.FILES, `projects/${USER}/${proj}/${path}`);
          const size = meta?.size || 0;
          if (fileCount >= DUMP_MAX_FILES && !ALWAYS_INCLUDE.has(path)) {
            skipped.push(path);
            continue;
          }
          if (size > DUMP_MAX_FILE_SIZE && !ALWAYS_INCLUDE.has(path)) {
            skipped.push(path);
            continue;
          }
          const object = await env2.FILES.get(`projects/${USER}/${proj}/${path}`);
          if (!object) {
            skipped.push(path);
            continue;
          }
          const buf = await object.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const ext = path.split(".").pop().toLowerCase();
          const binary = ["png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "gz", "woff", "woff2", "ttf", "eot", "mp3", "mp4", "wasm", "bin"].includes(ext) || bytes.includes(0);
          if (binary) {
            skipped.push(path);
            continue;
          }
          const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          if (totalBytes + content.length > DUMP_MAX_TOTAL && !ALWAYS_INCLUDE.has(path)) {
            skipped.push(path);
            continue;
          }
          totalBytes += content.length;
          fileCount++;
          const icon = getFileIcon(path);
          sectionsHtml += `<section class="dump-section"><div class="dump-path">${icon}<span>${escapeHtml(path)}</span></div><div class="dump-code"><pre><code>${escapeHtml(content)}</code></pre></div></section>`;
        }
        if (!sectionsHtml) {
          sectionsHtml = '<div class="dump-empty">No files found in this project.</div>';
        }
        let metaHtml = `${fileCount} files shown`;
        if (skipped.length)
          metaHtml += ` \xB7 ${skipped.length} skipped`;
        metaHtml += ` \xB7 ${totalBytes.toLocaleString()} bytes`;
        const title2 = `TinyHub \u2014 ${USER}/${proj} (dump)`;
        tmpl = tmpl.replace("<!-- SSR_TITLE -->", escapeHtml(title2));
        tmpl = tmpl.replace("<!-- SSR_DUMP_CONTENT -->", `<div class="dump-meta">${escapeHtml(metaHtml)}</div>${sectionsHtml}`);
        tmpl = tmpl.replace("<!-- SSR_BROWSER_URL -->", `/p/${USER}/${proj}/`);
        return new Response(tmpl, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        });
      }
      const assetRes = await env2.ASSETS.fetch(request);
      if (assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error(err);
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-lVxDam/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-lVxDam/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
