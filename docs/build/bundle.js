
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop$1() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal$1(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop$1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init$1(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop$1,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop$1;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/footer/desktop.svelte generated by Svelte v3.46.4 */

    const file$6 = "src/footer/desktop.svelte";

    function create_fragment$6(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let t1;
    	let div1;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Support";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "support@wesics.com";
    			attr_dev(div0, "class", "is-size-3 txt-white");
    			add_location(div0, file$6, 22, 8, 798);
    			attr_dev(div1, "class", "is-size-5 txt-white pt-3");
    			add_location(div1, file$6, 23, 8, 853);
    			attr_dev(div2, "class", "column is-6 center");
    			add_location(div2, file$6, 21, 4, 757);
    			attr_dev(div3, "class", "columns p-3 pt-6 pb-6");
    			set_style(div3, "background-color", "#011566");
    			set_style(div3, "font-family", "livvic");
    			add_location(div3, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    		},
    		p: noop$1,
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Desktop', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Desktop> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Desktop$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$6, create_fragment$6, safe_not_equal$1, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Desktop",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var browser = createCommonjsModule(function (module, exports) {

    // ref: https://github.com/tc39/proposal-global
    var getGlobal = function () {
    	// the only reliable means to get the global object is
    	// `Function('return this')()`
    	// However, this causes CSP violations in Chrome apps.
    	if (typeof self !== 'undefined') { return self; }
    	if (typeof window !== 'undefined') { return window; }
    	if (typeof global !== 'undefined') { return global; }
    	throw new Error('unable to locate global object');
    };

    var global = getGlobal();

    module.exports = exports = global.fetch;

    // Needed for TypeScript and Webpack.
    if (global.fetch) {
    	exports.default = global.fetch.bind(global);
    }

    exports.Headers = global.Headers;
    exports.Request = global.Request;
    exports.Response = global.Response;
    });

    async function fetch_json(url,params){

        var result = { status: "failed" };
        console.log(params);
        try {
            const response = await browser(
                url,
                {
                    method: "POST",
                    body: params,
                    credentials: "same-origin",
                }
            );
            let data = await response;
            let data_json = await data.json();
            result = data_json;
        } catch (e) {
            console.error(e);
        }

        return result;
    }

    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __commonJS = (cb, mod) => function __require() {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));

    // node_modules/seedrandom/lib/alea.js
    var require_alea = __commonJS({
      "node_modules/seedrandom/lib/alea.js"(exports, module) {
        (function(global2, module2, define2) {
          function Alea(seed) {
            var me = this, mash = Mash();
            me.next = function() {
              var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
              me.s0 = me.s1;
              me.s1 = me.s2;
              return me.s2 = t - (me.c = t | 0);
            };
            me.c = 1;
            me.s0 = mash(" ");
            me.s1 = mash(" ");
            me.s2 = mash(" ");
            me.s0 -= mash(seed);
            if (me.s0 < 0) {
              me.s0 += 1;
            }
            me.s1 -= mash(seed);
            if (me.s1 < 0) {
              me.s1 += 1;
            }
            me.s2 -= mash(seed);
            if (me.s2 < 0) {
              me.s2 += 1;
            }
            mash = null;
          }
          function copy(f, t) {
            t.c = f.c;
            t.s0 = f.s0;
            t.s1 = f.s1;
            t.s2 = f.s2;
            return t;
          }
          function impl(seed, opts) {
            var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
            prng.int32 = function() {
              return xg.next() * 4294967296 | 0;
            };
            prng.double = function() {
              return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
            };
            prng.quick = prng;
            if (state) {
              if (typeof state == "object")
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          function Mash() {
            var n = 4022871197;
            var mash = function(data) {
              data = String(data);
              for (var i = 0; i < data.length; i++) {
                n += data.charCodeAt(i);
                var h = 0.02519603282416938 * n;
                n = h >>> 0;
                h -= n;
                h *= n;
                n = h >>> 0;
                h -= n;
                n += h * 4294967296;
              }
              return (n >>> 0) * 23283064365386963e-26;
            };
            return mash;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.alea = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // node_modules/seedrandom/lib/xor128.js
    var require_xor128 = __commonJS({
      "node_modules/seedrandom/lib/xor128.js"(exports, module) {
        (function(global2, module2, define2) {
          function XorGen(seed) {
            var me = this, strseed = "";
            me.x = 0;
            me.y = 0;
            me.z = 0;
            me.w = 0;
            me.next = function() {
              var t = me.x ^ me.x << 11;
              me.x = me.y;
              me.y = me.z;
              me.z = me.w;
              return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
            };
            if (seed === (seed | 0)) {
              me.x = seed;
            } else {
              strseed += seed;
            }
            for (var k = 0; k < strseed.length + 64; k++) {
              me.x ^= strseed.charCodeAt(k) | 0;
              me.next();
            }
          }
          function copy(f, t) {
            t.x = f.x;
            t.y = f.y;
            t.z = f.z;
            t.w = f.w;
            return t;
          }
          function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
              return (xg.next() >>> 0) / 4294967296;
            };
            prng.double = function() {
              do {
                var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
              } while (result === 0);
              return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
              if (typeof state == "object")
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.xor128 = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // node_modules/seedrandom/lib/xorwow.js
    var require_xorwow = __commonJS({
      "node_modules/seedrandom/lib/xorwow.js"(exports, module) {
        (function(global2, module2, define2) {
          function XorGen(seed) {
            var me = this, strseed = "";
            me.next = function() {
              var t = me.x ^ me.x >>> 2;
              me.x = me.y;
              me.y = me.z;
              me.z = me.w;
              me.w = me.v;
              return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
            };
            me.x = 0;
            me.y = 0;
            me.z = 0;
            me.w = 0;
            me.v = 0;
            if (seed === (seed | 0)) {
              me.x = seed;
            } else {
              strseed += seed;
            }
            for (var k = 0; k < strseed.length + 64; k++) {
              me.x ^= strseed.charCodeAt(k) | 0;
              if (k == strseed.length) {
                me.d = me.x << 10 ^ me.x >>> 4;
              }
              me.next();
            }
          }
          function copy(f, t) {
            t.x = f.x;
            t.y = f.y;
            t.z = f.z;
            t.w = f.w;
            t.v = f.v;
            t.d = f.d;
            return t;
          }
          function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
              return (xg.next() >>> 0) / 4294967296;
            };
            prng.double = function() {
              do {
                var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
              } while (result === 0);
              return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
              if (typeof state == "object")
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.xorwow = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // node_modules/seedrandom/lib/xorshift7.js
    var require_xorshift7 = __commonJS({
      "node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
        (function(global2, module2, define2) {
          function XorGen(seed) {
            var me = this;
            me.next = function() {
              var X = me.x, i = me.i, t, v;
              t = X[i];
              t ^= t >>> 7;
              v = t ^ t << 24;
              t = X[i + 1 & 7];
              v ^= t ^ t >>> 10;
              t = X[i + 3 & 7];
              v ^= t ^ t >>> 3;
              t = X[i + 4 & 7];
              v ^= t ^ t << 7;
              t = X[i + 7 & 7];
              t = t ^ t << 13;
              v ^= t ^ t << 9;
              X[i] = v;
              me.i = i + 1 & 7;
              return v;
            };
            function init2(me2, seed2) {
              var j, X = [];
              if (seed2 === (seed2 | 0)) {
                X[0] = seed2;
              } else {
                seed2 = "" + seed2;
                for (j = 0; j < seed2.length; ++j) {
                  X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
                }
              }
              while (X.length < 8)
                X.push(0);
              for (j = 0; j < 8 && X[j] === 0; ++j)
                ;
              if (j == 8)
                X[7] = -1;
              me2.x = X;
              me2.i = 0;
              for (j = 256; j > 0; --j) {
                me2.next();
              }
            }
            init2(me, seed);
          }
          function copy(f, t) {
            t.x = f.x.slice();
            t.i = f.i;
            return t;
          }
          function impl(seed, opts) {
            if (seed == null)
              seed = +new Date();
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
              return (xg.next() >>> 0) / 4294967296;
            };
            prng.double = function() {
              do {
                var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
              } while (result === 0);
              return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
              if (state.x)
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.xorshift7 = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // node_modules/seedrandom/lib/xor4096.js
    var require_xor4096 = __commonJS({
      "node_modules/seedrandom/lib/xor4096.js"(exports, module) {
        (function(global2, module2, define2) {
          function XorGen(seed) {
            var me = this;
            me.next = function() {
              var w = me.w, X = me.X, i = me.i, t, v;
              me.w = w = w + 1640531527 | 0;
              v = X[i + 34 & 127];
              t = X[i = i + 1 & 127];
              v ^= v << 13;
              t ^= t << 17;
              v ^= v >>> 15;
              t ^= t >>> 12;
              v = X[i] = v ^ t;
              me.i = i;
              return v + (w ^ w >>> 16) | 0;
            };
            function init2(me2, seed2) {
              var t, v, i, j, w, X = [], limit = 128;
              if (seed2 === (seed2 | 0)) {
                v = seed2;
                seed2 = null;
              } else {
                seed2 = seed2 + "\0";
                v = 0;
                limit = Math.max(limit, seed2.length);
              }
              for (i = 0, j = -32; j < limit; ++j) {
                if (seed2)
                  v ^= seed2.charCodeAt((j + 32) % seed2.length);
                if (j === 0)
                  w = v;
                v ^= v << 10;
                v ^= v >>> 15;
                v ^= v << 4;
                v ^= v >>> 13;
                if (j >= 0) {
                  w = w + 1640531527 | 0;
                  t = X[j & 127] ^= v + w;
                  i = t == 0 ? i + 1 : 0;
                }
              }
              if (i >= 128) {
                X[(seed2 && seed2.length || 0) & 127] = -1;
              }
              i = 127;
              for (j = 4 * 128; j > 0; --j) {
                v = X[i + 34 & 127];
                t = X[i = i + 1 & 127];
                v ^= v << 13;
                t ^= t << 17;
                v ^= v >>> 15;
                t ^= t >>> 12;
                X[i] = v ^ t;
              }
              me2.w = w;
              me2.X = X;
              me2.i = i;
            }
            init2(me, seed);
          }
          function copy(f, t) {
            t.i = f.i;
            t.w = f.w;
            t.X = f.X.slice();
            return t;
          }
          function impl(seed, opts) {
            if (seed == null)
              seed = +new Date();
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
              return (xg.next() >>> 0) / 4294967296;
            };
            prng.double = function() {
              do {
                var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
              } while (result === 0);
              return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
              if (state.X)
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.xor4096 = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // node_modules/seedrandom/lib/tychei.js
    var require_tychei = __commonJS({
      "node_modules/seedrandom/lib/tychei.js"(exports, module) {
        (function(global2, module2, define2) {
          function XorGen(seed) {
            var me = this, strseed = "";
            me.next = function() {
              var b = me.b, c = me.c, d = me.d, a = me.a;
              b = b << 25 ^ b >>> 7 ^ c;
              c = c - d | 0;
              d = d << 24 ^ d >>> 8 ^ a;
              a = a - b | 0;
              me.b = b = b << 20 ^ b >>> 12 ^ c;
              me.c = c = c - d | 0;
              me.d = d << 16 ^ c >>> 16 ^ a;
              return me.a = a - b | 0;
            };
            me.a = 0;
            me.b = 0;
            me.c = 2654435769 | 0;
            me.d = 1367130551;
            if (seed === Math.floor(seed)) {
              me.a = seed / 4294967296 | 0;
              me.b = seed | 0;
            } else {
              strseed += seed;
            }
            for (var k = 0; k < strseed.length + 20; k++) {
              me.b ^= strseed.charCodeAt(k) | 0;
              me.next();
            }
          }
          function copy(f, t) {
            t.a = f.a;
            t.b = f.b;
            t.c = f.c;
            t.d = f.d;
            return t;
          }
          function impl(seed, opts) {
            var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
              return (xg.next() >>> 0) / 4294967296;
            };
            prng.double = function() {
              do {
                var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
              } while (result === 0);
              return result;
            };
            prng.int32 = xg.next;
            prng.quick = prng;
            if (state) {
              if (typeof state == "object")
                copy(state, xg);
              prng.state = function() {
                return copy(xg, {});
              };
            }
            return prng;
          }
          if (module2 && module2.exports) {
            module2.exports = impl;
          } else if (define2 && define2.amd) {
            define2(function() {
              return impl;
            });
          } else {
            this.tychei = impl;
          }
        })(exports, typeof module == "object" && module, typeof define == "function" && define);
      }
    });

    // (disabled):crypto
    var require_crypto = __commonJS({
      "(disabled):crypto"() {
      }
    });

    // node_modules/seedrandom/seedrandom.js
    var require_seedrandom = __commonJS({
      "node_modules/seedrandom/seedrandom.js"(exports, module) {
        (function(global2, pool, math) {
          var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
          function seedrandom2(seed, options, callback) {
            var key = [];
            options = options == true ? { entropy: true } : options || {};
            var shortseed = mixkey(flatten(options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed, 3), key);
            var arc4 = new ARC4(key);
            var prng = function() {
              var n = arc4.g(chunks), d = startdenom, x = 0;
              while (n < significance) {
                n = (n + x) * width;
                d *= width;
                x = arc4.g(1);
              }
              while (n >= overflow) {
                n /= 2;
                d /= 2;
                x >>>= 1;
              }
              return (n + x) / d;
            };
            prng.int32 = function() {
              return arc4.g(4) | 0;
            };
            prng.quick = function() {
              return arc4.g(4) / 4294967296;
            };
            prng.double = prng;
            mixkey(tostring(arc4.S), pool);
            return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
              if (state) {
                if (state.S) {
                  copy(state, arc4);
                }
                prng2.state = function() {
                  return copy(arc4, {});
                };
              }
              if (is_math_call) {
                math[rngname] = prng2;
                return seed2;
              } else
                return prng2;
            })(prng, shortseed, "global" in options ? options.global : this == math, options.state);
          }
          function ARC4(key) {
            var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
            if (!keylen) {
              key = [keylen++];
            }
            while (i < width) {
              s[i] = i++;
            }
            for (i = 0; i < width; i++) {
              s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
              s[j] = t;
            }
            (me.g = function(count) {
              var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
              while (count--) {
                t2 = s2[i2 = mask & i2 + 1];
                r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
              }
              me.i = i2;
              me.j = j2;
              return r;
            })(width);
          }
          function copy(f, t) {
            t.i = f.i;
            t.j = f.j;
            t.S = f.S.slice();
            return t;
          }
          function flatten(obj, depth) {
            var result = [], typ = typeof obj, prop;
            if (depth && typ == "object") {
              for (prop in obj) {
                try {
                  result.push(flatten(obj[prop], depth - 1));
                } catch (e) {
                }
              }
            }
            return result.length ? result : typ == "string" ? obj : obj + "\0";
          }
          function mixkey(seed, key) {
            var stringseed = seed + "", smear, j = 0;
            while (j < stringseed.length) {
              key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
            }
            return tostring(key);
          }
          function autoseed() {
            try {
              var out;
              if (nodecrypto && (out = nodecrypto.randomBytes)) {
                out = out(width);
              } else {
                out = new Uint8Array(width);
                (global2.crypto || global2.msCrypto).getRandomValues(out);
              }
              return tostring(out);
            } catch (e) {
              var browser = global2.navigator, plugins = browser && browser.plugins;
              return [+new Date(), global2, plugins, global2.screen, tostring(pool)];
            }
          }
          function tostring(a) {
            return String.fromCharCode.apply(0, a);
          }
          mixkey(math.random(), pool);
          if (typeof module == "object" && module.exports) {
            module.exports = seedrandom2;
            try {
              nodecrypto = require_crypto();
            } catch (ex) {
            }
          } else if (typeof define == "function" && define.amd) {
            define(function() {
              return seedrandom2;
            });
          } else {
            math["seed" + rngname] = seedrandom2;
          }
        })(typeof self !== "undefined" ? self : exports, [], Math);
      }
    });

    // node_modules/seedrandom/index.js
    var require_seedrandom2 = __commonJS({
      "node_modules/seedrandom/index.js"(exports, module) {
        var alea = require_alea();
        var xor128 = require_xor128();
        var xorwow = require_xorwow();
        var xorshift7 = require_xorshift7();
        var xor4096 = require_xor4096();
        var tychei = require_tychei();
        var sr = require_seedrandom();
        sr.alea = alea;
        sr.xor128 = xor128;
        sr.xorwow = xorwow;
        sr.xorshift7 = xorshift7;
        sr.xor4096 = xor4096;
        sr.tychei = tychei;
        module.exports = sr;
      }
    });

    // src/internal/config.ts
    var init = {
      disable: false,
      debug: false,
      ref: "",
      highlightLogs: false,
      highlightColor: "tomato",
      root: null,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      threshold: 0.6,
      transition: "fly",
      reset: false,
      delay: 0,
      duration: 800,
      easing: "custom",
      customEasing: [0.25, 0.1, 0.25, 0.1],
      x: -20,
      y: -20,
      rotate: -360,
      opacity: 0,
      blur: 16,
      scale: 0,
      onRevealStart: () => null,
      onRevealEnd: () => null,
      onResetStart: () => null,
      onResetEnd: () => null,
      onMount: () => null,
      onUpdate: () => null,
      onDestroy: () => null
    };
    var config = {
      dev: true,
      once: false,
      responsive: {
        mobile: {
          enabled: true,
          breakpoint: 425
        },
        tablet: {
          enabled: true,
          breakpoint: 768
        },
        laptop: {
          enabled: true,
          breakpoint: 1440
        },
        desktop: {
          enabled: true,
          breakpoint: 2560
        }
      },
      observer: {
        root: init.root,
        rootMargin: `${init.marginTop}px ${init.marginRight}px ${init.marginBottom}px ${init.marginLeft}px`,
        threshold: init.threshold
      }
    };

    // src/internal/validations.ts
    var hasValidRange = (property, min, max) => {
      return property >= min && property <= max;
    };
    var isPositive = (property) => property >= 0;
    var isPositiveInteger = (property) => {
      return isPositive(property) && Number.isInteger(property);
    };
    var checkOptions = (options) => {
      const finalOptions = Object.assign({}, init, options);
      const { threshold, opacity, delay, duration, blur, scale } = finalOptions;
      if (hasValidRange(threshold, 0, 1) && hasValidRange(opacity, 0, 1) && isPositive(delay) && isPositive(duration) && isPositive(blur) && isPositive(scale)) {
        return finalOptions;
      }
      throw new Error("Invalid options");
    };

    // src/internal/styling/breakpoints.ts
    var hasOverlappingBreakpoints = (responsive) => {
      const { mobile, tablet, laptop, desktop } = responsive;
      return mobile.breakpoint > tablet.breakpoint || tablet.breakpoint > laptop.breakpoint || laptop.breakpoint > desktop.breakpoint;
    };
    var hasValidBreakpoints = (responsive) => {
      const breakpoints = Object.values(responsive).map((device) => device.breakpoint);
      breakpoints.forEach((breakpoint) => {
        if (!isPositiveInteger(breakpoint)) {
          throw new Error("Breakpoints must be positive integers");
        }
      });
      if (hasOverlappingBreakpoints(responsive)) {
        throw new Error("Breakpoints can't overlap");
      }
      return true;
    };

    // src/internal/styling/classesGeneration.ts
    var import_seedrandom = __toESM(require_seedrandom2(), 1);
    var clean = (styles) => styles.trim().replace(/[\n|\t]/g, "").replace(/\s(\s+)/g, " ");

    // src/internal/styling/mediaQueries.ts
    var createQuery = (devices, i, beginning, end) => {
      const smallest = Math.min(...devices.map(([, settings]) => settings.breakpoint));
      const largest = Math.max(...devices.map(([, settings]) => settings.breakpoint));
      let query;
      if (beginning === smallest) {
        query = `(max-width: ${end}px)`;
      } else {
        const previous = devices[i - 1][1];
        if (end === largest) {
          query = `(min-width: ${previous.breakpoint + 1}px)`;
        } else {
          query = `(min-width: ${previous.breakpoint + 1}px) and (max-width: ${end}px)`;
        }
      }
      return query;
    };
    var findOptimalQueries = (devices) => {
      const queries = [];
      let i = 0;
      while (i < devices.length) {
        if (devices[i][1].enabled) {
          let j = i;
          let query = "";
          while (j < devices.length && devices[j][1].enabled) {
            const beginning = devices[i][1].breakpoint;
            const end = devices[j][1].breakpoint;
            query = createQuery(devices, i, beginning, end);
            j++;
          }
          queries.push(query);
          i = j;
        } else {
          i++;
        }
      }
      return queries;
    };
    var addMediaQueries = (styles, responsive = config.responsive) => {
      const devices = Object.entries(responsive);
      const allDevicesEnabled = devices.every(([, settings]) => settings.enabled);
      const allDevicesDisabled = devices.every(([, settings]) => !settings.enabled);
      if (allDevicesEnabled)
        return styles;
      if (allDevicesDisabled) {
        return clean(`
		@media not all {
			${styles}
		}
	`);
      }
      hasValidBreakpoints(responsive);
      return clean(`
		@media ${findOptimalQueries(devices).join(", ")} {
			${styles}
		}
	`);
    };

    // src/internal/DOM.ts
    var markRevealNode = (revealNode) => {
      revealNode.setAttribute("data-action", "reveal");
      return revealNode;
    };
    var activateRevealNode = (revealNode, className, baseClassName, options) => {
      markRevealNode(revealNode);
      const mainCss = createMainCss(className, options);
      const transitionCss = createTransitionCss(baseClassName, options);
      const stylesheet = document.querySelector('style[data-action="reveal"]');
      if (stylesheet) {
        const newStyles = getUpdatedStyles(stylesheet.innerHTML, clean(mainCss), clean(transitionCss));
        stylesheet.innerHTML = newStyles;
        revealNode.classList.add(className);
        revealNode.classList.add(baseClassName);
      }
      return revealNode;
    };
    var getRevealNode = (node) => {
      let revealNode;
      if (node.style.length === 0) {
        revealNode = node;
      } else {
        const wrapper = document.createElement("div");
        wrapper.appendChild(node);
        revealNode = wrapper;
      }
      return revealNode;
    };
    var createObserver = (canDebug, highlightText, revealNode, options, className) => {
      const { ref, reset, duration, delay, threshold, onResetStart, onResetEnd, onRevealEnd } = options;
      return new IntersectionObserver((entries, observer) => {
        if (canDebug) {
          const entry = entries[0];
          const entryTarget = entry.target;
          if (entryTarget === revealNode) {
            console.groupCollapsed(`%cRef: ${ref} (Intersection Observer Callback)`, highlightText);
            console.log(entry);
            console.groupEnd();
          }
        }
        entries.forEach((entry) => {
          if (reset && !entry.isIntersecting) {
            onResetStart(revealNode);
            revealNode.classList.add(className);
            setTimeout(() => onResetEnd(revealNode), duration + delay);
          } else if (entry.intersectionRatio >= threshold) {
            setTimeout(() => onRevealEnd(revealNode), duration + delay);
            revealNode.classList.remove(className);
            if (!reset)
              observer.unobserve(revealNode);
          }
        });
      }, config.observer);
    };
    var logInfo = (finalOptions, revealNode) => {
      const { debug, ref, highlightLogs, highlightColor } = finalOptions;
      const canDebug = config.dev && debug && ref !== "";
      const highlightText = `color: ${highlightLogs ? highlightColor : "#B4BEC8"}`;
      if (canDebug) {
        console.groupCollapsed(`%cRef: ${ref}`, highlightText);
        console.groupCollapsed("%cNode", highlightText);
        console.log(revealNode);
        console.groupEnd();
        console.groupCollapsed("%cConfig", highlightText);
        console.log(config);
        console.groupEnd();
        console.groupCollapsed("%cOptions", highlightText);
        console.log(finalOptions);
        console.groupEnd();
      }
      return [canDebug, highlightText];
    };

    // src/internal/styling/stylesExtraction.ts
    var extractCssRules = (styles) => {
      return clean(styles).split(";").filter((rule) => rule !== "").map((rule) => rule.trim());
    };
    var sanitizeStyles = (styles) => {
      return extractCssRules(styles).join("; ").concat("; ");
    };

    // src/internal/styling/stylesGeneration.ts
    var createStylesheet = () => {
      const style = document.createElement("style");
      style.setAttribute("type", "text/css");
      markRevealNode(style);
      const head = document.querySelector("head");
      if (head !== null)
        head.appendChild(style);
    };
    var addVendors = (unprefixedStyles) => {
      const rules = extractCssRules(unprefixedStyles);
      let prefixedStyles = "";
      rules.forEach((rule) => {
        const [property, value] = rule.trim().split(":").map((x) => x.trim());
        prefixedStyles += sanitizeStyles(`
			-webkit-${property}: ${value};
			-ms-${property}: ${value};
			${property}: ${value};
		`);
      });
      return prefixedStyles.trim();
    };

    // src/internal/styling/stylesRetrieval.ts
    var getUpdatedStyles = (oldStyles, mainCss, transitionCss) => {
      const prevStyles = getMinifiedStylesFromQuery(oldStyles);
      const newStyles = clean([mainCss, transitionCss].join(" "));
      const decorated = addMediaQueries([prevStyles, newStyles].join(" "));
      return decorated.trim();
    };
    var getMinifiedStylesFromQuery = (query) => {
      const cleaned = clean(query.trim());
      if (cleaned === "" || !cleaned.startsWith("@media"))
        return cleaned;
      return clean(cleaned.replace(/{/, "___").split("___")[1].slice(0, -1).trim());
    };
    var getCssRules = (transition, options) => {
      const { x, y, rotate, opacity, blur, scale } = Object.assign({}, init, options);
      let styles = "";
      if (transition === "fly") {
        styles = `
			opacity: ${opacity};
			transform: translateY(${y}px);
		`;
      } else if (transition === "fade") {
        styles = `
			opacity: ${opacity};
		`;
      } else if (transition === "blur") {
        styles = `
			opacity: ${opacity};
			filter: blur(${blur}px);
		`;
      } else if (transition === "scale") {
        styles = `
			opacity: ${opacity};
			transform: scale(${scale});
		`;
      } else if (transition === "slide") {
        styles = `
			opacity: ${opacity};
			transform: translateX(${x}px);
		`;
      } else if (transition === "spin") {
        styles = `
			opacity: ${opacity};
			transform: rotate(${rotate}deg);
		`;
      } else {
        throw new Error("Invalid CSS class name");
      }
      return addVendors(styles);
    };
    var getEasing = (easing, customEasing) => {
      const weightsObj = {
        linear: [0, 0, 1, 1],
        easeInSine: [0.12, 0, 0.39, 0],
        easeOutSine: [0.61, 1, 0.88, 1],
        easeInOutSine: [0.37, 0, 0.63, 1],
        easeInQuad: [0.11, 0, 0.5, 0],
        easeOutQuad: [0.5, 1, 0.89, 1],
        easeInOutQuad: [0.45, 0, 0.55, 1],
        easeInCubic: [0.32, 0, 0.67, 0],
        easeOutCubic: [0.33, 1, 0.68, 1],
        easeInOutCubic: [0.65, 0, 0.35, 1],
        easeInQuart: [0.5, 0, 0.75, 0],
        easeOutQuart: [0.25, 1, 0.5, 1],
        easeInOutQuart: [0.76, 0, 0.24, 1],
        easeInQuint: [0.64, 0, 0.78, 0],
        easeOutQuint: [0.22, 1, 0.36, 1],
        easeInOutQuint: [0.83, 0, 0.17, 1],
        easeInExpo: [0.7, 0, 0.84, 0],
        easeOutExpo: [0.16, 1, 0.3, 1],
        easeInOutExpo: [0.87, 0, 0.13, 1],
        easeInCirc: [0.55, 0, 1, 0.45],
        easeOutCirc: [0, 0.55, 0.45, 1],
        easeInOutCirc: [0.85, 0, 0.15, 1],
        easeInBack: [0.36, 0, 0.66, -0.56],
        easeOutBack: [0.34, 1.56, 0.64, 1],
        easeInOutBack: [0.68, -0.6, 0.32, 1.6]
      };
      let weights;
      if (easing === "custom" && customEasing !== void 0) {
        weights = customEasing;
      } else if (easing !== "custom" && Object.keys(weightsObj).includes(easing)) {
        weights = weightsObj[easing];
      } else {
        throw new Error("Invalid easing function");
      }
      return `cubic-bezier(${weights.join(", ")})`;
    };

    // src/internal/styling/classesGeneration.ts
    var createClassNames = (ref, transitionClass, transition) => {
      const tokens = [ref, transitionClass ? "base" : "", transition];
      const validTokens = tokens.filter((x) => x && x !== "");
      const prefix = `sr__${validTokens.join("__")}__`;
      const seed = document.querySelectorAll('[data-action="reveal"]').length;
      const uid = (0, import_seedrandom.default)(seed.toString())();
      return `${prefix}${uid.toString().slice(2)}`;
    };
    var createMainCss = (className, options) => {
      const { transition } = options;
      return `
		.${className} {
			${getCssRules(transition, options)}
		}
	`;
    };
    var createTransitionCss = (className, options) => {
      const { duration, delay, easing, customEasing } = options;
      const styles = `
		transition: all ${duration / 1e3}s ${delay / 1e3}s ${getEasing(easing, customEasing)};
	`;
      return `
		.${className} {
			${styles.trim()}
		}
	`;
    };

    // node_modules/svelte/internal/index.mjs
    function noop() {
    }
    function safe_not_equal(a, b) {
      return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
    }
    Promise.resolve();

    // node_modules/svelte/store/index.mjs
    var subscriber_queue = [];
    function writable(value, start = noop) {
      let stop;
      const subscribers = /* @__PURE__ */ new Set();
      function set(new_value) {
        if (safe_not_equal(value, new_value)) {
          value = new_value;
          if (stop) {
            const run_queue = !subscriber_queue.length;
            for (const subscriber of subscribers) {
              subscriber[1]();
              subscriber_queue.push(subscriber, value);
            }
            if (run_queue) {
              for (let i = 0; i < subscriber_queue.length; i += 2) {
                subscriber_queue[i][0](subscriber_queue[i + 1]);
              }
              subscriber_queue.length = 0;
            }
          }
        }
      }
      function update(fn) {
        set(fn(value));
      }
      function subscribe2(run2, invalidate = noop) {
        const subscriber = [run2, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
          stop = start(set) || noop;
        }
        run2(value);
        return () => {
          subscribers.delete(subscriber);
          if (subscribers.size === 0) {
            stop();
            stop = null;
          }
        };
      }
      return { set, update, subscribe: subscribe2 };
    }

    // src/internal/stores.ts
    var styleTagStore = writable(false);
    var reloadStore = writable(false);

    // src/internal/reveal.ts
    var reveal = (node, options = init) => {
      const finalOptions = checkOptions(options);
      const { transition, disable, ref, onRevealStart, onMount, onUpdate, onDestroy } = finalOptions;
      const revealNode = getRevealNode(node);
      const className = createClassNames(ref, false, transition);
      const baseClassName = createClassNames(ref, true, transition);
      onMount(revealNode);
      const [canDebug, highlightText] = logInfo(finalOptions, revealNode);
      let reloaded = false;
      const unsubscribeReloaded = reloadStore.subscribe((value) => reloaded = value);
      const navigation = window.performance.getEntriesByType("navigation");
      let navigationType = "";
      if (navigation.length > 0) {
        navigationType = navigation[0].type;
      } else {
        navigationType = window.performance.navigation.type;
      }
      if (navigationType === "reload" || navigationType === 1)
        reloadStore.set(true);
      if (disable || config.once && reloaded)
        return {};
      let styleTagExists = false;
      const unsubscribeStyleTag = styleTagStore.subscribe((value) => styleTagExists = value);
      if (!styleTagExists) {
        createStylesheet();
        styleTagStore.set(true);
      }
      onRevealStart(revealNode);
      activateRevealNode(revealNode, className, baseClassName, finalOptions);
      const ObserverInstance = createObserver(canDebug, highlightText, revealNode, finalOptions, className);
      ObserverInstance.observe(revealNode);
      console.groupEnd();
      return {
        update() {
          onUpdate(revealNode);
        },
        destroy() {
          onDestroy(revealNode);
          unsubscribeStyleTag();
          unsubscribeReloaded();
        }
      };
    };

    const defaultOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0,
        unobserveOnEnter: false,
    };
    const createEvent = (name, detail) => new CustomEvent(name, { detail });
    function inview(node, options = {}) {
        const { root, rootMargin, threshold, unobserveOnEnter } = Object.assign(Object.assign({}, defaultOptions), options);
        let prevPos = {
            x: undefined,
            y: undefined,
        };
        let scrollDirection = {
            vertical: undefined,
            horizontal: undefined,
        };
        if (typeof IntersectionObserver !== 'undefined' && node) {
            const observer = new IntersectionObserver((entries, _observer) => {
                entries.forEach((singleEntry) => {
                    if (prevPos.y > singleEntry.boundingClientRect.y) {
                        scrollDirection.vertical = 'up';
                    }
                    else {
                        scrollDirection.vertical = 'down';
                    }
                    if (prevPos.x > singleEntry.boundingClientRect.x) {
                        scrollDirection.horizontal = 'left';
                    }
                    else {
                        scrollDirection.horizontal = 'right';
                    }
                    prevPos = {
                        y: singleEntry.boundingClientRect.y,
                        x: singleEntry.boundingClientRect.x,
                    };
                    const detail = {
                        inView: singleEntry.isIntersecting,
                        entry: singleEntry,
                        scrollDirection,
                        node,
                        observer: _observer,
                    };
                    node.dispatchEvent(createEvent('change', detail));
                    if (singleEntry.isIntersecting) {
                        node.dispatchEvent(createEvent('enter', detail));
                        unobserveOnEnter && _observer.unobserve(node);
                    }
                    else {
                        node.dispatchEvent(createEvent('leave', detail));
                    }
                });
            }, {
                root,
                rootMargin,
                threshold,
            });
            // This dispatcher has to be wrapped in setTimeout, as it won't work otherwise.
            // Not sure why is it happening, maybe a callstack has to pass between the listeners?
            // Definitely something to investigate to understand better.
            setTimeout(() => {
                node.dispatchEvent(createEvent('init', { observer, node }));
            }, 0);
            observer.observe(node);
            return {
                destroy() {
                    observer.unobserve(node);
                },
            };
        }
    }

    /* src/home/trade.svelte generated by Svelte v3.46.4 */

    const file$5 = "src/home/trade.svelte";

    function create_fragment$5(ctx) {
    	let div55;
    	let div54;
    	let div1;
    	let div0;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let div53;
    	let div52;
    	let div51;
    	let div50;
    	let div49;
    	let div11;
    	let div4;
    	let div3;
    	let label0;
    	let t4;
    	let div2;
    	let input0;
    	let t5;
    	let div7;
    	let div6;
    	let label1;
    	let t7;
    	let div5;
    	let input1;
    	let t8;
    	let div10;
    	let div9;
    	let label2;
    	let t10;
    	let div8;
    	let input2;
    	let t11;
    	let div19;
    	let div13;
    	let label3;
    	let t13;
    	let div12;
    	let input3;
    	let t14;
    	let div15;
    	let label4;
    	let t16;
    	let div14;
    	let input4;
    	let t17;
    	let div18;
    	let label5;
    	let t19;
    	let div17;
    	let div16;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let option5;
    	let t26;
    	let div26;
    	let div21;
    	let label6;
    	let t28;
    	let div20;
    	let input5;
    	let t29;
    	let div23;
    	let label7;
    	let t31;
    	let div22;
    	let input6;
    	let t32;
    	let div25;
    	let label8;
    	let t34;
    	let div24;
    	let input7;
    	let t35;
    	let div33;
    	let div28;
    	let label9;
    	let t37;
    	let div27;
    	let input8;
    	let t38;
    	let div30;
    	let label10;
    	let t40;
    	let div29;
    	let input9;
    	let t41;
    	let div32;
    	let label11;
    	let t43;
    	let div31;
    	let input10;
    	let t44;
    	let div40;
    	let div35;
    	let label12;
    	let t46;
    	let div34;
    	let input11;
    	let t47;
    	let div37;
    	let label13;
    	let t49;
    	let div36;
    	let input12;
    	let t50;
    	let div39;
    	let label14;
    	let t52;
    	let div38;
    	let input13;
    	let t53;
    	let div47;
    	let div42;
    	let label15;
    	let t55;
    	let div41;
    	let input14;
    	let t56;
    	let div44;
    	let label16;
    	let t58;
    	let div43;
    	let input15;
    	let t59;
    	let div46;
    	let label17;
    	let t61;
    	let div45;
    	let input16;
    	let t62;
    	let div48;
    	let button0;
    	let t64;
    	let button1;
    	let t66;
    	let button2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div55 = element("div");
    			div54 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Don't Hesitate To Contact Us For ");
    			br = element("br");
    			t1 = text(" Better Information And Services");
    			t2 = space();
    			div53 = element("div");
    			div52 = element("div");
    			div51 = element("div");
    			div50 = element("div");
    			div49 = element("div");
    			div11 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			label0 = element("label");
    			label0.textContent = "Enter Symbol Name";
    			t4 = space();
    			div2 = element("div");
    			input0 = element("input");
    			t5 = space();
    			div7 = element("div");
    			div6 = element("div");
    			label1 = element("label");
    			label1.textContent = "Enter Activation Price (Optional)";
    			t7 = space();
    			div5 = element("div");
    			input1 = element("input");
    			t8 = space();
    			div10 = element("div");
    			div9 = element("div");
    			label2 = element("label");
    			label2.textContent = "Enter Order Price";
    			t10 = space();
    			div8 = element("div");
    			input2 = element("input");
    			t11 = space();
    			div19 = element("div");
    			div13 = element("div");
    			label3 = element("label");
    			label3.textContent = "Stop loss";
    			t13 = space();
    			div12 = element("div");
    			input3 = element("input");
    			t14 = space();
    			div15 = element("div");
    			label4 = element("label");
    			label4.textContent = "Stop loss Price";
    			t16 = space();
    			div14 = element("div");
    			input4 = element("input");
    			t17 = space();
    			div18 = element("div");
    			label5 = element("label");
    			label5.textContent = "Stop loss trailing";
    			t19 = space();
    			div17 = element("div");
    			div16 = element("div");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "No Trailing";
    			option1 = element("option");
    			option1.textContent = "Trail on Entry & target price";
    			option2 = element("option");
    			option2.textContent = "Trail on amount";
    			option3 = element("option");
    			option3.textContent = "Trail on Percentage";
    			option4 = element("option");
    			option4.textContent = "Trail on amount after trigger";
    			option5 = element("option");
    			option5.textContent = "Trail on Percentage after trigger";
    			t26 = space();
    			div26 = element("div");
    			div21 = element("div");
    			label6 = element("label");
    			label6.textContent = "Target 1";
    			t28 = space();
    			div20 = element("div");
    			input5 = element("input");
    			t29 = space();
    			div23 = element("div");
    			label7 = element("label");
    			label7.textContent = "Price";
    			t31 = space();
    			div22 = element("div");
    			input6 = element("input");
    			t32 = space();
    			div25 = element("div");
    			label8 = element("label");
    			label8.textContent = "Validity";
    			t34 = space();
    			div24 = element("div");
    			input7 = element("input");
    			t35 = space();
    			div33 = element("div");
    			div28 = element("div");
    			label9 = element("label");
    			label9.textContent = "Target 2";
    			t37 = space();
    			div27 = element("div");
    			input8 = element("input");
    			t38 = space();
    			div30 = element("div");
    			label10 = element("label");
    			label10.textContent = "Price";
    			t40 = space();
    			div29 = element("div");
    			input9 = element("input");
    			t41 = space();
    			div32 = element("div");
    			label11 = element("label");
    			label11.textContent = "Validity";
    			t43 = space();
    			div31 = element("div");
    			input10 = element("input");
    			t44 = space();
    			div40 = element("div");
    			div35 = element("div");
    			label12 = element("label");
    			label12.textContent = "Target 3";
    			t46 = space();
    			div34 = element("div");
    			input11 = element("input");
    			t47 = space();
    			div37 = element("div");
    			label13 = element("label");
    			label13.textContent = "Price";
    			t49 = space();
    			div36 = element("div");
    			input12 = element("input");
    			t50 = space();
    			div39 = element("div");
    			label14 = element("label");
    			label14.textContent = "Validity";
    			t52 = space();
    			div38 = element("div");
    			input13 = element("input");
    			t53 = space();
    			div47 = element("div");
    			div42 = element("div");
    			label15 = element("label");
    			label15.textContent = "Target 4";
    			t55 = space();
    			div41 = element("div");
    			input14 = element("input");
    			t56 = space();
    			div44 = element("div");
    			label16 = element("label");
    			label16.textContent = "Price";
    			t58 = space();
    			div43 = element("div");
    			input15 = element("input");
    			t59 = space();
    			div46 = element("div");
    			label17 = element("label");
    			label17.textContent = "Validity";
    			t61 = space();
    			div45 = element("div");
    			input16 = element("input");
    			t62 = space();
    			div48 = element("div");
    			button0 = element("button");
    			button0.textContent = "Send Order";
    			t64 = space();
    			button1 = element("button");
    			button1.textContent = "Reset";
    			t66 = space();
    			button2 = element("button");
    			button2.textContent = "Cancel Order";
    			add_location(br, file$5, 18, 49, 502);
    			attr_dev(div0, "class", "has-text-centered is-size-4 txt-white p-3 pb-5 has-text-weight-bold");
    			set_style(div0, "font-family", "livvic");
    			add_location(div0, file$5, 14, 12, 297);
    			attr_dev(div1, "class", "py-3 px-2 m-0");
    			set_style(div1, "background-color", "#010166");
    			set_style(div1, "padding-bottom", "7rem", 1);
    			add_location(div1, file$5, 10, 8, 159);
    			attr_dev(label0, "class", "label");
    			add_location(label0, file$5, 29, 40, 1016);
    			attr_dev(input0, "class", "input is-normal is-roundedr");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Enter Symbol Name");
    			add_location(input0, file$5, 33, 44, 1255);
    			attr_dev(div2, "class", "control");
    			add_location(div2, file$5, 32, 40, 1189);
    			attr_dev(div3, "class", "field");
    			add_location(div3, file$5, 28, 36, 956);
    			attr_dev(div4, "class", "column");
    			add_location(div4, file$5, 27, 32, 899);
    			attr_dev(label1, "class", "label");
    			add_location(label1, file$5, 43, 40, 1813);
    			attr_dev(input1, "class", "input is-normal is-roundedr");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Enter Activation Price (Optional)");
    			add_location(input1, file$5, 47, 44, 2068);
    			attr_dev(div5, "class", "control");
    			add_location(div5, file$5, 46, 40, 2002);
    			attr_dev(div6, "class", "field");
    			add_location(div6, file$5, 42, 36, 1753);
    			attr_dev(div7, "class", "column");
    			add_location(div7, file$5, 41, 32, 1696);
    			attr_dev(label2, "class", "label");
    			add_location(label2, file$5, 57, 40, 2642);
    			attr_dev(input2, "class", "input is-normal is-roundedr");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "placeholder", "Enter Order Price ");
    			add_location(input2, file$5, 61, 44, 2881);
    			attr_dev(div8, "class", "control");
    			add_location(div8, file$5, 60, 40, 2815);
    			attr_dev(div9, "class", "field");
    			add_location(div9, file$5, 56, 36, 2582);
    			attr_dev(div10, "class", "column");
    			add_location(div10, file$5, 55, 32, 2525);
    			attr_dev(div11, "class", "columns");
    			add_location(div11, file$5, 26, 28, 845);
    			attr_dev(label3, "class", "label");
    			add_location(label3, file$5, 73, 36, 3470);
    			attr_dev(input3, "type", "checkbox");
    			add_location(input3, file$5, 75, 40, 3607);
    			attr_dev(div12, "class", "control");
    			add_location(div12, file$5, 74, 36, 3545);
    			attr_dev(div13, "class", "field px-3");
    			add_location(div13, file$5, 72, 32, 3409);
    			attr_dev(label4, "class", "label");
    			add_location(label4, file$5, 80, 36, 3809);
    			attr_dev(input4, "class", "input is-normal is-roundedr");
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "placeholder", "Price");
    			add_location(input4, file$5, 82, 40, 3952);
    			attr_dev(div14, "class", "control");
    			add_location(div14, file$5, 81, 36, 3890);
    			attr_dev(div15, "class", "field px-3");
    			add_location(div15, file$5, 79, 32, 3748);
    			attr_dev(label5, "class", "label");
    			add_location(label5, file$5, 91, 36, 4380);
    			option0.__value = "No Trailing";
    			option0.value = option0.__value;
    			add_location(option0, file$5, 95, 46, 4646);
    			option1.__value = "Trail on Entry & target price";
    			option1.value = option1.__value;
    			add_location(option1, file$5, 96, 46, 4721);
    			option2.__value = "Trail on amount";
    			option2.value = option2.__value;
    			add_location(option2, file$5, 97, 46, 4814);
    			option3.__value = "Trail on Percentage";
    			option3.value = option3.__value;
    			add_location(option3, file$5, 98, 46, 4893);
    			option4.__value = "Trail on amount after trigger";
    			option4.value = option4.__value;
    			add_location(option4, file$5, 99, 46, 4976);
    			option5.__value = "Trail on Percentage after trigger";
    			option5.value = option5.__value;
    			add_location(option5, file$5, 100, 46, 5069);
    			add_location(select, file$5, 94, 44, 4591);
    			attr_dev(div16, "class", "select");
    			add_location(div16, file$5, 93, 40, 4526);
    			attr_dev(div17, "class", "control");
    			add_location(div17, file$5, 92, 36, 4464);
    			attr_dev(div18, "class", "field px-3");
    			add_location(div18, file$5, 90, 32, 4319);
    			attr_dev(div19, "class", "columns");
    			add_location(div19, file$5, 71, 28, 3355);
    			attr_dev(label6, "class", "label");
    			add_location(label6, file$5, 110, 36, 5485);
    			attr_dev(input5, "type", "checkbox");
    			add_location(input5, file$5, 112, 40, 5621);
    			attr_dev(div20, "class", "control");
    			add_location(div20, file$5, 111, 36, 5559);
    			attr_dev(div21, "class", "field px-3");
    			add_location(div21, file$5, 109, 32, 5424);
    			attr_dev(label7, "class", "label");
    			add_location(label7, file$5, 117, 36, 5823);
    			attr_dev(input6, "class", "input is-normal is-roundedr");
    			attr_dev(input6, "type", "text");
    			attr_dev(input6, "placeholder", "Price");
    			add_location(input6, file$5, 119, 40, 5956);
    			attr_dev(div22, "class", "control");
    			add_location(div22, file$5, 118, 36, 5894);
    			attr_dev(div23, "class", "field px-3");
    			add_location(div23, file$5, 116, 32, 5762);
    			attr_dev(label8, "class", "label");
    			add_location(label8, file$5, 128, 36, 6384);
    			attr_dev(input7, "class", "input is-normal is-roundedr");
    			attr_dev(input7, "type", "text");
    			attr_dev(input7, "placeholder", "Validity");
    			add_location(input7, file$5, 130, 40, 6520);
    			attr_dev(div24, "class", "control");
    			add_location(div24, file$5, 129, 36, 6458);
    			attr_dev(div25, "class", "field px-3");
    			add_location(div25, file$5, 127, 32, 6323);
    			attr_dev(div26, "class", "columns");
    			add_location(div26, file$5, 108, 28, 5370);
    			attr_dev(label9, "class", "label");
    			add_location(label9, file$5, 141, 36, 7036);
    			attr_dev(input8, "type", "checkbox");
    			add_location(input8, file$5, 143, 40, 7172);
    			attr_dev(div27, "class", "control");
    			add_location(div27, file$5, 142, 36, 7110);
    			attr_dev(div28, "class", "field px-3");
    			add_location(div28, file$5, 140, 32, 6975);
    			attr_dev(label10, "class", "label");
    			add_location(label10, file$5, 148, 36, 7374);
    			attr_dev(input9, "class", "input is-normal is-roundedr");
    			attr_dev(input9, "type", "text");
    			attr_dev(input9, "placeholder", "Price");
    			add_location(input9, file$5, 150, 40, 7507);
    			attr_dev(div29, "class", "control");
    			add_location(div29, file$5, 149, 36, 7445);
    			attr_dev(div30, "class", "field px-3");
    			add_location(div30, file$5, 147, 32, 7313);
    			attr_dev(label11, "class", "label");
    			add_location(label11, file$5, 159, 36, 7935);
    			attr_dev(input10, "class", "input is-normal is-roundedr");
    			attr_dev(input10, "type", "text");
    			attr_dev(input10, "placeholder", "Validity");
    			add_location(input10, file$5, 161, 40, 8071);
    			attr_dev(div31, "class", "control");
    			add_location(div31, file$5, 160, 36, 8009);
    			attr_dev(div32, "class", "field px-3");
    			add_location(div32, file$5, 158, 32, 7874);
    			attr_dev(div33, "class", "columns");
    			add_location(div33, file$5, 139, 28, 6921);
    			attr_dev(label12, "class", "label");
    			add_location(label12, file$5, 172, 36, 8587);
    			attr_dev(input11, "type", "checkbox");
    			add_location(input11, file$5, 174, 40, 8723);
    			attr_dev(div34, "class", "control");
    			add_location(div34, file$5, 173, 36, 8661);
    			attr_dev(div35, "class", "field px-3");
    			add_location(div35, file$5, 171, 32, 8526);
    			attr_dev(label13, "class", "label");
    			add_location(label13, file$5, 179, 36, 8925);
    			attr_dev(input12, "class", "input is-normal is-roundedr");
    			attr_dev(input12, "type", "text");
    			attr_dev(input12, "placeholder", "Price");
    			add_location(input12, file$5, 181, 40, 9058);
    			attr_dev(div36, "class", "control");
    			add_location(div36, file$5, 180, 36, 8996);
    			attr_dev(div37, "class", "field px-3");
    			add_location(div37, file$5, 178, 32, 8864);
    			attr_dev(label14, "class", "label");
    			add_location(label14, file$5, 190, 36, 9486);
    			attr_dev(input13, "class", "input is-normal is-roundedr");
    			attr_dev(input13, "type", "text");
    			attr_dev(input13, "placeholder", "Validity");
    			add_location(input13, file$5, 192, 40, 9622);
    			attr_dev(div38, "class", "control");
    			add_location(div38, file$5, 191, 36, 9560);
    			attr_dev(div39, "class", "field px-3");
    			add_location(div39, file$5, 189, 32, 9425);
    			attr_dev(div40, "class", "columns");
    			add_location(div40, file$5, 170, 28, 8472);
    			attr_dev(label15, "class", "label");
    			add_location(label15, file$5, 203, 36, 10138);
    			attr_dev(input14, "type", "checkbox");
    			add_location(input14, file$5, 205, 40, 10274);
    			attr_dev(div41, "class", "control");
    			add_location(div41, file$5, 204, 36, 10212);
    			attr_dev(div42, "class", "field px-3");
    			add_location(div42, file$5, 202, 32, 10077);
    			attr_dev(label16, "class", "label");
    			add_location(label16, file$5, 210, 36, 10476);
    			attr_dev(input15, "class", "input is-normal is-roundedr");
    			attr_dev(input15, "type", "text");
    			attr_dev(input15, "placeholder", "Price");
    			add_location(input15, file$5, 212, 40, 10609);
    			attr_dev(div43, "class", "control");
    			add_location(div43, file$5, 211, 36, 10547);
    			attr_dev(div44, "class", "field px-3");
    			add_location(div44, file$5, 209, 32, 10415);
    			attr_dev(label17, "class", "label");
    			add_location(label17, file$5, 221, 36, 11037);
    			attr_dev(input16, "class", "input is-normal is-roundedr");
    			attr_dev(input16, "type", "text");
    			attr_dev(input16, "placeholder", "Validity");
    			add_location(input16, file$5, 223, 40, 11173);
    			attr_dev(div45, "class", "control");
    			add_location(div45, file$5, 222, 36, 11111);
    			attr_dev(div46, "class", "field px-3");
    			add_location(div46, file$5, 220, 32, 10976);
    			attr_dev(div47, "class", "columns");
    			add_location(div47, file$5, 201, 28, 10023);
    			attr_dev(button0, "class", "button is-danger is-normal is-roundedr");
    			add_location(button0, file$5, 233, 32, 11648);
    			attr_dev(button1, "class", "button is-warning is-normal is-roundedr");
    			add_location(button1, file$5, 238, 32, 11917);
    			attr_dev(button2, "class", "button is-normal is-roundedr");
    			add_location(button2, file$5, 243, 32, 12182);
    			attr_dev(div48, "class", "container has-text-centered");
    			add_location(div48, file$5, 232, 28, 11574);
    			attr_dev(div49, "class", "column px-6");
    			add_location(div49, file$5, 25, 24, 790);
    			attr_dev(div50, "class", "columns");
    			add_location(div50, file$5, 24, 20, 744);
    			attr_dev(div51, "class", "card-content p-0");
    			add_location(div51, file$5, 23, 16, 693);
    			attr_dev(div52, "class", "card");
    			set_style(div52, "transform", "translateY(-7rem)");
    			add_location(div52, file$5, 22, 12, 620);
    			attr_dev(div53, "class", "px-5 mx-5");
    			add_location(div53, file$5, 21, 8, 583);
    			attr_dev(div54, "id", "contact-us");
    			add_location(div54, file$5, 9, 4, 129);
    			set_style(div55, "width", "100vw");
    			add_location(div55, file$5, 8, 0, 99);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div55, anchor);
    			append_dev(div55, div54);
    			append_dev(div54, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, br);
    			append_dev(div0, t1);
    			append_dev(div54, t2);
    			append_dev(div54, div53);
    			append_dev(div53, div52);
    			append_dev(div52, div51);
    			append_dev(div51, div50);
    			append_dev(div50, div49);
    			append_dev(div49, div11);
    			append_dev(div11, div4);
    			append_dev(div4, div3);
    			append_dev(div3, label0);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, input0);
    			append_dev(div11, t5);
    			append_dev(div11, div7);
    			append_dev(div7, div6);
    			append_dev(div6, label1);
    			append_dev(div6, t7);
    			append_dev(div6, div5);
    			append_dev(div5, input1);
    			append_dev(div11, t8);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, label2);
    			append_dev(div9, t10);
    			append_dev(div9, div8);
    			append_dev(div8, input2);
    			append_dev(div49, t11);
    			append_dev(div49, div19);
    			append_dev(div19, div13);
    			append_dev(div13, label3);
    			append_dev(div13, t13);
    			append_dev(div13, div12);
    			append_dev(div12, input3);
    			append_dev(div19, t14);
    			append_dev(div19, div15);
    			append_dev(div15, label4);
    			append_dev(div15, t16);
    			append_dev(div15, div14);
    			append_dev(div14, input4);
    			append_dev(div19, t17);
    			append_dev(div19, div18);
    			append_dev(div18, label5);
    			append_dev(div18, t19);
    			append_dev(div18, div17);
    			append_dev(div17, div16);
    			append_dev(div16, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			append_dev(select, option4);
    			append_dev(select, option5);
    			append_dev(div49, t26);
    			append_dev(div49, div26);
    			append_dev(div26, div21);
    			append_dev(div21, label6);
    			append_dev(div21, t28);
    			append_dev(div21, div20);
    			append_dev(div20, input5);
    			append_dev(div26, t29);
    			append_dev(div26, div23);
    			append_dev(div23, label7);
    			append_dev(div23, t31);
    			append_dev(div23, div22);
    			append_dev(div22, input6);
    			append_dev(div26, t32);
    			append_dev(div26, div25);
    			append_dev(div25, label8);
    			append_dev(div25, t34);
    			append_dev(div25, div24);
    			append_dev(div24, input7);
    			append_dev(div49, t35);
    			append_dev(div49, div33);
    			append_dev(div33, div28);
    			append_dev(div28, label9);
    			append_dev(div28, t37);
    			append_dev(div28, div27);
    			append_dev(div27, input8);
    			append_dev(div33, t38);
    			append_dev(div33, div30);
    			append_dev(div30, label10);
    			append_dev(div30, t40);
    			append_dev(div30, div29);
    			append_dev(div29, input9);
    			append_dev(div33, t41);
    			append_dev(div33, div32);
    			append_dev(div32, label11);
    			append_dev(div32, t43);
    			append_dev(div32, div31);
    			append_dev(div31, input10);
    			append_dev(div49, t44);
    			append_dev(div49, div40);
    			append_dev(div40, div35);
    			append_dev(div35, label12);
    			append_dev(div35, t46);
    			append_dev(div35, div34);
    			append_dev(div34, input11);
    			append_dev(div40, t47);
    			append_dev(div40, div37);
    			append_dev(div37, label13);
    			append_dev(div37, t49);
    			append_dev(div37, div36);
    			append_dev(div36, input12);
    			append_dev(div40, t50);
    			append_dev(div40, div39);
    			append_dev(div39, label14);
    			append_dev(div39, t52);
    			append_dev(div39, div38);
    			append_dev(div38, input13);
    			append_dev(div49, t53);
    			append_dev(div49, div47);
    			append_dev(div47, div42);
    			append_dev(div42, label15);
    			append_dev(div42, t55);
    			append_dev(div42, div41);
    			append_dev(div41, input14);
    			append_dev(div47, t56);
    			append_dev(div47, div44);
    			append_dev(div44, label16);
    			append_dev(div44, t58);
    			append_dev(div44, div43);
    			append_dev(div43, input15);
    			append_dev(div47, t59);
    			append_dev(div47, div46);
    			append_dev(div46, label17);
    			append_dev(div46, t61);
    			append_dev(div46, div45);
    			append_dev(div45, input16);
    			append_dev(div49, t62);
    			append_dev(div49, div48);
    			append_dev(div48, button0);
    			append_dev(div48, t64);
    			append_dev(div48, button1);
    			append_dev(div48, t66);
    			append_dev(div48, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler$1, false, false, false),
    					listen_dev(button1, "click", click_handler_1$1, false, false, false),
    					listen_dev(button2, "click", click_handler_2$1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop$1,
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div55);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const click_handler$1 = () => {
    	
    };

    const click_handler_1$1 = () => {
    	
    };

    const click_handler_2$1 = () => {
    	
    };

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Trade', slots, []);
    	let mobile;
    	let email;
    	let name;
    	let subject;
    	let message;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Trade> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ mobile, email, name, subject, message });

    	$$self.$inject_state = $$props => {
    		if ('mobile' in $$props) mobile = $$props.mobile;
    		if ('email' in $$props) email = $$props.email;
    		if ('name' in $$props) name = $$props.name;
    		if ('subject' in $$props) subject = $$props.subject;
    		if ('message' in $$props) message = $$props.message;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class Trade extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$5, create_fragment$5, safe_not_equal$1, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Trade",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    var siema_min = createCommonjsModule(function (module, exports) {
    !function(e,t){module.exports=t();}("undefined"!=typeof self?self:commonjsGlobal,function(){return function(e){function t(r){if(i[r])return i[r].exports;var n=i[r]={i:r,l:!1,exports:{}};return e[r].call(n.exports,n,n.exports,t),n.l=!0,n.exports}var i={};return t.m=e,t.c=i,t.d=function(e,i,r){t.o(e,i)||Object.defineProperty(e,i,{configurable:!1,enumerable:!0,get:r});},t.n=function(e){var i=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(i,"a",i),i},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=0)}([function(e,t,i){function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s=function(){function e(e,t){for(var i=0;i<t.length;i++){var r=t[i];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r);}}return function(t,i,r){return i&&e(t.prototype,i),r&&e(t,r),t}}(),l=function(){function e(t){var i=this;if(r(this,e),this.config=e.mergeSettings(t),this.selector="string"==typeof this.config.selector?document.querySelector(this.config.selector):this.config.selector,null===this.selector)throw new Error("Something wrong with your selector 😭");this.resolveSlidesNumber(),this.selectorWidth=this.selector.offsetWidth,this.innerElements=[].slice.call(this.selector.children),this.currentSlide=this.config.loop?this.config.startIndex%this.innerElements.length:Math.max(0,Math.min(this.config.startIndex,this.innerElements.length-this.perPage)),this.transformProperty=e.webkitOrNot(),["resizeHandler","touchstartHandler","touchendHandler","touchmoveHandler","mousedownHandler","mouseupHandler","mouseleaveHandler","mousemoveHandler","clickHandler"].forEach(function(e){i[e]=i[e].bind(i);}),this.init();}return s(e,[{key:"attachEvents",value:function(){window.addEventListener("resize",this.resizeHandler),this.config.draggable&&(this.pointerDown=!1,this.drag={startX:0,endX:0,startY:0,letItGo:null,preventClick:!1},this.selector.addEventListener("touchstart",this.touchstartHandler),this.selector.addEventListener("touchend",this.touchendHandler),this.selector.addEventListener("touchmove",this.touchmoveHandler),this.selector.addEventListener("mousedown",this.mousedownHandler),this.selector.addEventListener("mouseup",this.mouseupHandler),this.selector.addEventListener("mouseleave",this.mouseleaveHandler),this.selector.addEventListener("mousemove",this.mousemoveHandler),this.selector.addEventListener("click",this.clickHandler));}},{key:"detachEvents",value:function(){window.removeEventListener("resize",this.resizeHandler),this.selector.removeEventListener("touchstart",this.touchstartHandler),this.selector.removeEventListener("touchend",this.touchendHandler),this.selector.removeEventListener("touchmove",this.touchmoveHandler),this.selector.removeEventListener("mousedown",this.mousedownHandler),this.selector.removeEventListener("mouseup",this.mouseupHandler),this.selector.removeEventListener("mouseleave",this.mouseleaveHandler),this.selector.removeEventListener("mousemove",this.mousemoveHandler),this.selector.removeEventListener("click",this.clickHandler);}},{key:"init",value:function(){this.attachEvents(),this.selector.style.overflow="hidden",this.selector.style.direction=this.config.rtl?"rtl":"ltr",this.buildSliderFrame(),this.config.onInit.call(this);}},{key:"buildSliderFrame",value:function(){var e=this.selectorWidth/this.perPage,t=this.config.loop?this.innerElements.length+2*this.perPage:this.innerElements.length;this.sliderFrame=document.createElement("div"),this.sliderFrame.style.width=e*t+"px",this.enableTransition(),this.config.draggable&&(this.selector.style.cursor="-webkit-grab");var i=document.createDocumentFragment();if(this.config.loop)for(var r=this.innerElements.length-this.perPage;r<this.innerElements.length;r++){var n=this.buildSliderFrameItem(this.innerElements[r].cloneNode(!0));i.appendChild(n);}for(var s=0;s<this.innerElements.length;s++){var l=this.buildSliderFrameItem(this.innerElements[s]);i.appendChild(l);}if(this.config.loop)for(var o=0;o<this.perPage;o++){var a=this.buildSliderFrameItem(this.innerElements[o].cloneNode(!0));i.appendChild(a);}this.sliderFrame.appendChild(i),this.selector.innerHTML="",this.selector.appendChild(this.sliderFrame),this.slideToCurrent();}},{key:"buildSliderFrameItem",value:function(e){var t=document.createElement("div");return t.style.cssFloat=this.config.rtl?"right":"left",t.style.float=this.config.rtl?"right":"left",t.style.width=(this.config.loop?100/(this.innerElements.length+2*this.perPage):100/this.innerElements.length)+"%",t.appendChild(e),t}},{key:"resolveSlidesNumber",value:function(){if("number"==typeof this.config.perPage)this.perPage=this.config.perPage;else if("object"===n(this.config.perPage)){this.perPage=1;for(var e in this.config.perPage)window.innerWidth>=e&&(this.perPage=this.config.perPage[e]);}}},{key:"prev",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1,t=arguments[1];if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;if(this.config.loop){if(this.currentSlide-e<0){this.disableTransition();var r=this.currentSlide+this.innerElements.length,n=this.perPage,s=r+n,l=(this.config.rtl?1:-1)*s*(this.selectorWidth/this.perPage),o=this.config.draggable?this.drag.endX-this.drag.startX:0;this.sliderFrame.style[this.transformProperty]="translate3d("+(l+o)+"px, 0, 0)",this.currentSlide=r-e;}else this.currentSlide=this.currentSlide-e;}else this.currentSlide=Math.max(this.currentSlide-e,0);i!==this.currentSlide&&(this.slideToCurrent(this.config.loop),this.config.onChange.call(this),t&&t.call(this));}}},{key:"next",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1,t=arguments[1];if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;if(this.config.loop){if(this.currentSlide+e>this.innerElements.length-this.perPage){this.disableTransition();var r=this.currentSlide-this.innerElements.length,n=this.perPage,s=r+n,l=(this.config.rtl?1:-1)*s*(this.selectorWidth/this.perPage),o=this.config.draggable?this.drag.endX-this.drag.startX:0;this.sliderFrame.style[this.transformProperty]="translate3d("+(l+o)+"px, 0, 0)",this.currentSlide=r+e;}else this.currentSlide=this.currentSlide+e;}else this.currentSlide=Math.min(this.currentSlide+e,this.innerElements.length-this.perPage);i!==this.currentSlide&&(this.slideToCurrent(this.config.loop),this.config.onChange.call(this),t&&t.call(this));}}},{key:"disableTransition",value:function(){this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;}},{key:"enableTransition",value:function(){this.sliderFrame.style.webkitTransition="all "+this.config.duration+"ms "+this.config.easing,this.sliderFrame.style.transition="all "+this.config.duration+"ms "+this.config.easing;}},{key:"goTo",value:function(e,t){if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;this.currentSlide=this.config.loop?e%this.innerElements.length:Math.min(Math.max(e,0),this.innerElements.length-this.perPage),i!==this.currentSlide&&(this.slideToCurrent(),this.config.onChange.call(this),t&&t.call(this));}}},{key:"slideToCurrent",value:function(e){var t=this,i=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,r=(this.config.rtl?1:-1)*i*(this.selectorWidth/this.perPage);e?requestAnimationFrame(function(){requestAnimationFrame(function(){t.enableTransition(),t.sliderFrame.style[t.transformProperty]="translate3d("+r+"px, 0, 0)";});}):this.sliderFrame.style[this.transformProperty]="translate3d("+r+"px, 0, 0)";}},{key:"updateAfterDrag",value:function(){var e=(this.config.rtl?-1:1)*(this.drag.endX-this.drag.startX),t=Math.abs(e),i=this.config.multipleDrag?Math.ceil(t/(this.selectorWidth/this.perPage)):1,r=e>0&&this.currentSlide-i<0,n=e<0&&this.currentSlide+i>this.innerElements.length-this.perPage;e>0&&t>this.config.threshold&&this.innerElements.length>this.perPage?this.prev(i):e<0&&t>this.config.threshold&&this.innerElements.length>this.perPage&&this.next(i),this.slideToCurrent(r||n);}},{key:"resizeHandler",value:function(){this.resolveSlidesNumber(),this.currentSlide+this.perPage>this.innerElements.length&&(this.currentSlide=this.innerElements.length<=this.perPage?0:this.innerElements.length-this.perPage),this.selectorWidth=this.selector.offsetWidth,this.buildSliderFrame();}},{key:"clearDrag",value:function(){this.drag={startX:0,endX:0,startY:0,letItGo:null,preventClick:this.drag.preventClick};}},{key:"touchstartHandler",value:function(e){-1!==["TEXTAREA","OPTION","INPUT","SELECT"].indexOf(e.target.nodeName)||(e.stopPropagation(),this.pointerDown=!0,this.drag.startX=e.touches[0].pageX,this.drag.startY=e.touches[0].pageY);}},{key:"touchendHandler",value:function(e){e.stopPropagation(),this.pointerDown=!1,this.enableTransition(),this.drag.endX&&this.updateAfterDrag(),this.clearDrag();}},{key:"touchmoveHandler",value:function(e){if(e.stopPropagation(),null===this.drag.letItGo&&(this.drag.letItGo=Math.abs(this.drag.startY-e.touches[0].pageY)<Math.abs(this.drag.startX-e.touches[0].pageX)),this.pointerDown&&this.drag.letItGo){e.preventDefault(),this.drag.endX=e.touches[0].pageX,this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;var t=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,i=t*(this.selectorWidth/this.perPage),r=this.drag.endX-this.drag.startX,n=this.config.rtl?i+r:i-r;this.sliderFrame.style[this.transformProperty]="translate3d("+(this.config.rtl?1:-1)*n+"px, 0, 0)";}}},{key:"mousedownHandler",value:function(e){-1!==["TEXTAREA","OPTION","INPUT","SELECT"].indexOf(e.target.nodeName)||(e.preventDefault(),e.stopPropagation(),this.pointerDown=!0,this.drag.startX=e.pageX);}},{key:"mouseupHandler",value:function(e){e.stopPropagation(),this.pointerDown=!1,this.selector.style.cursor="-webkit-grab",this.enableTransition(),this.drag.endX&&this.updateAfterDrag(),this.clearDrag();}},{key:"mousemoveHandler",value:function(e){if(e.preventDefault(),this.pointerDown){"A"===e.target.nodeName&&(this.drag.preventClick=!0),this.drag.endX=e.pageX,this.selector.style.cursor="-webkit-grabbing",this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;var t=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,i=t*(this.selectorWidth/this.perPage),r=this.drag.endX-this.drag.startX,n=this.config.rtl?i+r:i-r;this.sliderFrame.style[this.transformProperty]="translate3d("+(this.config.rtl?1:-1)*n+"px, 0, 0)";}}},{key:"mouseleaveHandler",value:function(e){this.pointerDown&&(this.pointerDown=!1,this.selector.style.cursor="-webkit-grab",this.drag.endX=e.pageX,this.drag.preventClick=!1,this.enableTransition(),this.updateAfterDrag(),this.clearDrag());}},{key:"clickHandler",value:function(e){this.drag.preventClick&&e.preventDefault(),this.drag.preventClick=!1;}},{key:"remove",value:function(e,t){if(e<0||e>=this.innerElements.length)throw new Error("Item to remove doesn't exist 😭");var i=e<this.currentSlide,r=this.currentSlide+this.perPage-1===e;(i||r)&&this.currentSlide--,this.innerElements.splice(e,1),this.buildSliderFrame(),t&&t.call(this);}},{key:"insert",value:function(e,t,i){if(t<0||t>this.innerElements.length+1)throw new Error("Unable to inset it at this index 😭");if(-1!==this.innerElements.indexOf(e))throw new Error("The same item in a carousel? Really? Nope 😭");var r=t<=this.currentSlide>0&&this.innerElements.length;this.currentSlide=r?this.currentSlide+1:this.currentSlide,this.innerElements.splice(t,0,e),this.buildSliderFrame(),i&&i.call(this);}},{key:"prepend",value:function(e,t){this.insert(e,0),t&&t.call(this);}},{key:"append",value:function(e,t){this.insert(e,this.innerElements.length+1),t&&t.call(this);}},{key:"destroy",value:function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0],t=arguments[1];if(this.detachEvents(),this.selector.style.cursor="auto",e){for(var i=document.createDocumentFragment(),r=0;r<this.innerElements.length;r++)i.appendChild(this.innerElements[r]);this.selector.innerHTML="",this.selector.appendChild(i),this.selector.removeAttribute("style");}t&&t.call(this);}}],[{key:"mergeSettings",value:function(e){var t={selector:".siema",duration:200,easing:"ease-out",perPage:1,startIndex:0,draggable:!0,multipleDrag:!0,threshold:20,loop:!1,rtl:!1,onInit:function(){},onChange:function(){}},i=e;for(var r in i)t[r]=i[r];return t}},{key:"webkitOrNot",value:function(){return "string"==typeof document.documentElement.style.transform?"transform":"WebkitTransform"}}]),e}();t.default=l,e.exports=t.default;}])});
    });

    var Siema = /*@__PURE__*/getDefaultExportFromCjs(siema_min);

    /* node_modules/@beyonk/svelte-carousel/src/Carousel.svelte generated by Svelte v3.46.4 */
    const file$4 = "node_modules/@beyonk/svelte-carousel/src/Carousel.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	child_ctx[33] = i;
    	return child_ctx;
    }

    const get_right_control_slot_changes = dirty => ({});
    const get_right_control_slot_context = ctx => ({});
    const get_left_control_slot_changes = dirty => ({});
    const get_left_control_slot_context = ctx => ({});

    // (6:1) {#if controls}
    function create_if_block_1$1(ctx) {
    	let button0;
    	let t;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;
    	const left_control_slot_template = /*#slots*/ ctx[24]["left-control"];
    	const left_control_slot = create_slot(left_control_slot_template, ctx, /*$$scope*/ ctx[23], get_left_control_slot_context);
    	const right_control_slot_template = /*#slots*/ ctx[24]["right-control"];
    	const right_control_slot = create_slot(right_control_slot_template, ctx, /*$$scope*/ ctx[23], get_right_control_slot_context);

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			if (left_control_slot) left_control_slot.c();
    			t = space();
    			button1 = element("button");
    			if (right_control_slot) right_control_slot.c();
    			attr_dev(button0, "class", "left svelte-1ppqxio");
    			attr_dev(button0, "aria-label", "left");
    			add_location(button0, file$4, 6, 1, 105);
    			attr_dev(button1, "class", "right svelte-1ppqxio");
    			attr_dev(button1, "aria-label", "right");
    			add_location(button1, file$4, 9, 1, 209);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);

    			if (left_control_slot) {
    				left_control_slot.m(button0, null);
    			}

    			insert_dev(target, t, anchor);
    			insert_dev(target, button1, anchor);

    			if (right_control_slot) {
    				right_control_slot.m(button1, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*left*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*right*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (left_control_slot) {
    				if (left_control_slot.p && (!current || dirty[0] & /*$$scope*/ 8388608)) {
    					update_slot_base(
    						left_control_slot,
    						left_control_slot_template,
    						ctx,
    						/*$$scope*/ ctx[23],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[23])
    						: get_slot_changes(left_control_slot_template, /*$$scope*/ ctx[23], dirty, get_left_control_slot_changes),
    						get_left_control_slot_context
    					);
    				}
    			}

    			if (right_control_slot) {
    				if (right_control_slot.p && (!current || dirty[0] & /*$$scope*/ 8388608)) {
    					update_slot_base(
    						right_control_slot,
    						right_control_slot_template,
    						ctx,
    						/*$$scope*/ ctx[23],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[23])
    						: get_slot_changes(right_control_slot_template, /*$$scope*/ ctx[23], dirty, get_right_control_slot_changes),
    						get_right_control_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(left_control_slot, local);
    			transition_in(right_control_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(left_control_slot, local);
    			transition_out(right_control_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (left_control_slot) left_control_slot.d(detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(button1);
    			if (right_control_slot) right_control_slot.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(6:1) {#if controls}",
    		ctx
    	});

    	return block;
    }

    // (14:4) {#if dots}
    function create_if_block$1(ctx) {
    	let ul;
    	let each_value = { length: /*totalDots*/ ctx[9] };
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "svelte-1ppqxio");
    			add_location(ul, file$4, 14, 1, 339);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*isDotActive, currentIndex, go, currentPerPage, totalDots*/ 740) {
    				each_value = { length: /*totalDots*/ ctx[9] };
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(14:4) {#if dots}",
    		ctx
    	});

    	return block;
    }

    // (16:2) {#each {length: totalDots} as _, i}
    function create_each_block$1(ctx) {
    	let li;
    	let li_class_value;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[26](/*i*/ ctx[33]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");

    			attr_dev(li, "class", li_class_value = "" + (null_to_empty(/*isDotActive*/ ctx[2](/*currentIndex*/ ctx[7], /*i*/ ctx[33])
    			? "active"
    			: "") + " svelte-1ppqxio"));

    			add_location(li, file$4, 16, 2, 384);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*currentIndex*/ 128 && li_class_value !== (li_class_value = "" + (null_to_empty(/*isDotActive*/ ctx[2](/*currentIndex*/ ctx[7], /*i*/ ctx[33])
    			? "active"
    			: "") + " svelte-1ppqxio"))) {
    				attr_dev(li, "class", li_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(16:2) {#each {length: totalDots} as _, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[24].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[23], null);
    	let if_block0 = /*controls*/ ctx[1] && create_if_block_1$1(ctx);
    	let if_block1 = /*dots*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div0, "class", "slides");
    			add_location(div0, file$4, 2, 1, 25);
    			attr_dev(div1, "class", "carousel svelte-1ppqxio");
    			add_location(div1, file$4, 1, 0, 1);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			/*div0_binding*/ ctx[25](div0);
    			append_dev(div1, t0);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t1);
    			if (if_block1) if_block1.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 8388608)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[23],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[23])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[23], dirty, null),
    						null
    					);
    				}
    			}

    			if (/*controls*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*controls*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div1, t1);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*dots*/ ctx[0]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    			/*div0_binding*/ ctx[25](null);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let pips;
    	let currentPerPage;
    	let totalDots;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Carousel', slots, ['default','left-control','right-control']);
    	let { perPage = 3 } = $$props;
    	let { loop = true } = $$props;
    	let { autoplay = 0 } = $$props;
    	let { duration = 200 } = $$props;
    	let { easing = 'ease-out' } = $$props;
    	let { startIndex = 0 } = $$props;
    	let { draggable = true } = $$props;
    	let { multipleDrag = true } = $$props;
    	let { dots = true } = $$props;
    	let { controls = true } = $$props;
    	let { threshold = 20 } = $$props;
    	let { rtl = false } = $$props;
    	let currentIndex = startIndex;
    	let siema;
    	let controller;
    	let timer;
    	const dispatch = createEventDispatcher();

    	onMount(() => {
    		$$invalidate(22, controller = new Siema({
    				selector: siema,
    				perPage: typeof perPage === 'object' ? perPage : Number(perPage),
    				loop,
    				duration,
    				easing,
    				startIndex,
    				draggable,
    				multipleDrag,
    				threshold,
    				rtl,
    				onChange: handleChange
    			}));

    		if (autoplay) {
    			timer = setInterval(right, autoplay);
    		}

    		return () => {
    			autoplay && clearInterval(timer);
    			timer = null;
    			controller.destroy();
    		};
    	});

    	function isDotActive(currentIndex, dotIndex) {
    		if (currentIndex < 0) currentIndex = pips.length + currentIndex;
    		return currentIndex >= dotIndex * currentPerPage && currentIndex < dotIndex * currentPerPage + currentPerPage;
    	}

    	function left() {
    		controller.prev();
    	}

    	function right() {
    		controller.next();
    	}

    	function go(index) {
    		controller.goTo(index);
    	}

    	function pause() {
    		clearInterval(timer);
    		timer = null;
    	}

    	function resume() {
    		if (autoplay && !timer) {
    			timer = setInterval(right, autoplay);
    		}
    	}

    	function handleChange(event) {
    		$$invalidate(7, currentIndex = controller.currentSlide);

    		dispatch('change', {
    			currentSlide: controller.currentSlide,
    			slideCount: controller.innerElements.length
    		});
    	}

    	const writable_props = [
    		'perPage',
    		'loop',
    		'autoplay',
    		'duration',
    		'easing',
    		'startIndex',
    		'draggable',
    		'multipleDrag',
    		'dots',
    		'controls',
    		'threshold',
    		'rtl'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Carousel> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			siema = $$value;
    			$$invalidate(8, siema);
    		});
    	}

    	const click_handler = i => go(i * currentPerPage);

    	$$self.$$set = $$props => {
    		if ('perPage' in $$props) $$invalidate(10, perPage = $$props.perPage);
    		if ('loop' in $$props) $$invalidate(11, loop = $$props.loop);
    		if ('autoplay' in $$props) $$invalidate(12, autoplay = $$props.autoplay);
    		if ('duration' in $$props) $$invalidate(13, duration = $$props.duration);
    		if ('easing' in $$props) $$invalidate(14, easing = $$props.easing);
    		if ('startIndex' in $$props) $$invalidate(15, startIndex = $$props.startIndex);
    		if ('draggable' in $$props) $$invalidate(16, draggable = $$props.draggable);
    		if ('multipleDrag' in $$props) $$invalidate(17, multipleDrag = $$props.multipleDrag);
    		if ('dots' in $$props) $$invalidate(0, dots = $$props.dots);
    		if ('controls' in $$props) $$invalidate(1, controls = $$props.controls);
    		if ('threshold' in $$props) $$invalidate(18, threshold = $$props.threshold);
    		if ('rtl' in $$props) $$invalidate(19, rtl = $$props.rtl);
    		if ('$$scope' in $$props) $$invalidate(23, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		Siema,
    		onMount,
    		createEventDispatcher,
    		perPage,
    		loop,
    		autoplay,
    		duration,
    		easing,
    		startIndex,
    		draggable,
    		multipleDrag,
    		dots,
    		controls,
    		threshold,
    		rtl,
    		currentIndex,
    		siema,
    		controller,
    		timer,
    		dispatch,
    		isDotActive,
    		left,
    		right,
    		go,
    		pause,
    		resume,
    		handleChange,
    		currentPerPage,
    		pips,
    		totalDots
    	});

    	$$self.$inject_state = $$props => {
    		if ('perPage' in $$props) $$invalidate(10, perPage = $$props.perPage);
    		if ('loop' in $$props) $$invalidate(11, loop = $$props.loop);
    		if ('autoplay' in $$props) $$invalidate(12, autoplay = $$props.autoplay);
    		if ('duration' in $$props) $$invalidate(13, duration = $$props.duration);
    		if ('easing' in $$props) $$invalidate(14, easing = $$props.easing);
    		if ('startIndex' in $$props) $$invalidate(15, startIndex = $$props.startIndex);
    		if ('draggable' in $$props) $$invalidate(16, draggable = $$props.draggable);
    		if ('multipleDrag' in $$props) $$invalidate(17, multipleDrag = $$props.multipleDrag);
    		if ('dots' in $$props) $$invalidate(0, dots = $$props.dots);
    		if ('controls' in $$props) $$invalidate(1, controls = $$props.controls);
    		if ('threshold' in $$props) $$invalidate(18, threshold = $$props.threshold);
    		if ('rtl' in $$props) $$invalidate(19, rtl = $$props.rtl);
    		if ('currentIndex' in $$props) $$invalidate(7, currentIndex = $$props.currentIndex);
    		if ('siema' in $$props) $$invalidate(8, siema = $$props.siema);
    		if ('controller' in $$props) $$invalidate(22, controller = $$props.controller);
    		if ('timer' in $$props) timer = $$props.timer;
    		if ('currentPerPage' in $$props) $$invalidate(6, currentPerPage = $$props.currentPerPage);
    		if ('pips' in $$props) pips = $$props.pips;
    		if ('totalDots' in $$props) $$invalidate(9, totalDots = $$props.totalDots);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*controller*/ 4194304) {
    			pips = controller ? controller.innerElements : [];
    		}

    		if ($$self.$$.dirty[0] & /*controller, perPage*/ 4195328) {
    			$$invalidate(6, currentPerPage = controller ? controller.perPage : perPage);
    		}

    		if ($$self.$$.dirty[0] & /*controller, currentPerPage*/ 4194368) {
    			$$invalidate(9, totalDots = controller
    			? Math.ceil(controller.innerElements.length / currentPerPage)
    			: []);
    		}
    	};

    	return [
    		dots,
    		controls,
    		isDotActive,
    		left,
    		right,
    		go,
    		currentPerPage,
    		currentIndex,
    		siema,
    		totalDots,
    		perPage,
    		loop,
    		autoplay,
    		duration,
    		easing,
    		startIndex,
    		draggable,
    		multipleDrag,
    		threshold,
    		rtl,
    		pause,
    		resume,
    		controller,
    		$$scope,
    		slots,
    		div0_binding,
    		click_handler
    	];
    }

    class Carousel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(
    			this,
    			options,
    			instance$4,
    			create_fragment$4,
    			safe_not_equal$1,
    			{
    				perPage: 10,
    				loop: 11,
    				autoplay: 12,
    				duration: 13,
    				easing: 14,
    				startIndex: 15,
    				draggable: 16,
    				multipleDrag: 17,
    				dots: 0,
    				controls: 1,
    				threshold: 18,
    				rtl: 19,
    				isDotActive: 2,
    				left: 3,
    				right: 4,
    				go: 5,
    				pause: 20,
    				resume: 21
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Carousel",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get perPage() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set perPage(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get loop() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loop(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get autoplay() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set autoplay(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get duration() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set duration(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get easing() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set easing(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get startIndex() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set startIndex(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get draggable() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set draggable(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get multipleDrag() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set multipleDrag(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dots() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dots(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get controls() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set controls(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threshold() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threshold(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rtl() {
    		throw new Error("<Carousel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rtl(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isDotActive() {
    		return this.$$.ctx[2];
    	}

    	set isDotActive(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get left() {
    		return this.$$.ctx[3];
    	}

    	set left(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get right() {
    		return this.$$.ctx[4];
    	}

    	set right(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get go() {
    		return this.$$.ctx[5];
    	}

    	set go(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pause() {
    		return this.$$.ctx[20];
    	}

    	set pause(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get resume() {
    		return this.$$.ctx[21];
    	}

    	set resume(value) {
    		throw new Error("<Carousel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/addons/bubbles.svelte generated by Svelte v3.46.4 */

    const file$3 = "src/addons/bubbles.svelte";

    function create_fragment$3(ctx) {
    	let div14;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let t2;
    	let div3;
    	let t3;
    	let div4;
    	let t4;
    	let div5;
    	let t5;
    	let div6;
    	let t6;
    	let div7;
    	let t7;
    	let div8;
    	let t8;
    	let div9;
    	let t9;
    	let div10;
    	let t10;
    	let div11;
    	let t11;
    	let div12;
    	let t12;
    	let div13;

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			t3 = space();
    			div4 = element("div");
    			t4 = space();
    			div5 = element("div");
    			t5 = space();
    			div6 = element("div");
    			t6 = space();
    			div7 = element("div");
    			t7 = space();
    			div8 = element("div");
    			t8 = space();
    			div9 = element("div");
    			t9 = space();
    			div10 = element("div");
    			t10 = space();
    			div11 = element("div");
    			t11 = space();
    			div12 = element("div");
    			t12 = space();
    			div13 = element("div");
    			attr_dev(div0, "class", "witr_circle witr_small witr_square1 svelte-1a19j1l");
    			add_location(div0, file$3, 1, 4, 38);
    			attr_dev(div1, "class", "witr_circle witr_small witr_square2 svelte-1a19j1l");
    			add_location(div1, file$3, 2, 4, 98);
    			attr_dev(div2, "class", "witr_circle witr_small witr_square3 svelte-1a19j1l");
    			add_location(div2, file$3, 3, 4, 158);
    			attr_dev(div3, "class", "witr_circle witr_small witr_square4 svelte-1a19j1l");
    			add_location(div3, file$3, 4, 4, 218);
    			attr_dev(div4, "class", "witr_circle witr_small witr_square5 svelte-1a19j1l");
    			add_location(div4, file$3, 5, 4, 278);
    			attr_dev(div5, "class", "witr_circle witr_medium witr_square1 svelte-1a19j1l");
    			add_location(div5, file$3, 6, 4, 338);
    			attr_dev(div6, "class", "witr_circle witr_medium witr_square2 svelte-1a19j1l");
    			add_location(div6, file$3, 7, 4, 399);
    			attr_dev(div7, "class", "witr_circle witr_medium witr_square3 svelte-1a19j1l");
    			add_location(div7, file$3, 8, 4, 460);
    			attr_dev(div8, "class", "witr_circle witr_medium witr_square4 svelte-1a19j1l");
    			add_location(div8, file$3, 9, 4, 521);
    			attr_dev(div9, "class", "witr_circle witr_medium witr_square5 svelte-1a19j1l");
    			add_location(div9, file$3, 10, 4, 582);
    			attr_dev(div10, "class", "witr_circle witr_large witr_square1 svelte-1a19j1l");
    			add_location(div10, file$3, 11, 4, 643);
    			attr_dev(div11, "class", "witr_circle witr_large witr_square2 svelte-1a19j1l");
    			add_location(div11, file$3, 12, 4, 703);
    			attr_dev(div12, "class", "witr_circle witr_large witr_square3 svelte-1a19j1l");
    			add_location(div12, file$3, 13, 4, 763);
    			attr_dev(div13, "class", "witr_circle witr_large witr_square4 svelte-1a19j1l");
    			add_location(div13, file$3, 14, 4, 823);
    			attr_dev(div14, "class", "witr_bubble_animate svelte-1a19j1l");
    			add_location(div14, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div14, anchor);
    			append_dev(div14, div0);
    			append_dev(div14, t0);
    			append_dev(div14, div1);
    			append_dev(div14, t1);
    			append_dev(div14, div2);
    			append_dev(div14, t2);
    			append_dev(div14, div3);
    			append_dev(div14, t3);
    			append_dev(div14, div4);
    			append_dev(div14, t4);
    			append_dev(div14, div5);
    			append_dev(div14, t5);
    			append_dev(div14, div6);
    			append_dev(div14, t6);
    			append_dev(div14, div7);
    			append_dev(div14, t7);
    			append_dev(div14, div8);
    			append_dev(div14, t8);
    			append_dev(div14, div9);
    			append_dev(div14, t9);
    			append_dev(div14, div10);
    			append_dev(div14, t10);
    			append_dev(div14, div11);
    			append_dev(div14, t11);
    			append_dev(div14, div12);
    			append_dev(div14, t12);
    			append_dev(div14, div13);
    		},
    		p: noop$1,
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bubbles', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bubbles> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Bubbles extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bubbles",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/home/carousel.svelte generated by Svelte v3.46.4 */
    const file$2 = "src/home/carousel.svelte";

    // (7:0) <Carousel perPage={1} autoplay={3500}>
    function create_default_slot$1(ctx) {
    	let div13;
    	let div12;
    	let bubbles0;
    	let t0;
    	let div11;
    	let div0;
    	let t1;
    	let div1;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let div2;
    	let t3;
    	let div3;
    	let t4;
    	let div9;
    	let div8;
    	let div7;
    	let div4;
    	let t6;
    	let div5;
    	let t7;
    	let span0;
    	let t9;
    	let div6;
    	let t11;
    	let a0;
    	let button0;
    	let t13;
    	let div10;
    	let t14;
    	let div26;
    	let div25;
    	let bubbles1;
    	let t15;
    	let div24;
    	let div14;
    	let t16;
    	let div15;
    	let img1;
    	let img1_src_value;
    	let t17;
    	let div16;
    	let t18;
    	let div17;
    	let t19;
    	let div22;
    	let div21;
    	let div20;
    	let div18;
    	let t20;
    	let span1;
    	let t22;
    	let div19;
    	let t24;
    	let a1;
    	let button1;
    	let t26;
    	let div23;
    	let t27;
    	let div39;
    	let div38;
    	let bubbles2;
    	let t28;
    	let div37;
    	let div27;
    	let t29;
    	let div28;
    	let img2;
    	let img2_src_value;
    	let t30;
    	let div29;
    	let t31;
    	let div30;
    	let t32;
    	let div35;
    	let div34;
    	let div33;
    	let div31;
    	let t33;
    	let span2;
    	let t35;
    	let t36;
    	let div32;
    	let t38;
    	let a2;
    	let button2;
    	let t40;
    	let div36;
    	let t41;
    	let div52;
    	let div51;
    	let bubbles3;
    	let t42;
    	let div50;
    	let div40;
    	let t43;
    	let div41;
    	let img3;
    	let img3_src_value;
    	let t44;
    	let div42;
    	let t45;
    	let div43;
    	let t46;
    	let div48;
    	let div47;
    	let div46;
    	let div44;
    	let span3;
    	let t48;
    	let t49;
    	let div45;
    	let t51;
    	let a3;
    	let button3;
    	let t53;
    	let div49;
    	let t54;
    	let div65;
    	let div64;
    	let bubbles4;
    	let t55;
    	let div63;
    	let div53;
    	let t56;
    	let div54;
    	let img4;
    	let img4_src_value;
    	let t57;
    	let div55;
    	let t58;
    	let div56;
    	let t59;
    	let div61;
    	let div60;
    	let div59;
    	let div57;
    	let span4;
    	let t61;
    	let t62;
    	let div58;
    	let t64;
    	let a4;
    	let button4;
    	let t66;
    	let div62;
    	let current;
    	let mounted;
    	let dispose;
    	bubbles0 = new Bubbles({ $$inline: true });
    	bubbles1 = new Bubbles({ $$inline: true });
    	bubbles2 = new Bubbles({ $$inline: true });
    	bubbles3 = new Bubbles({ $$inline: true });
    	bubbles4 = new Bubbles({ $$inline: true });

    	const block = {
    		c: function create() {
    			div13 = element("div");
    			div12 = element("div");
    			create_component(bubbles0.$$.fragment);
    			t0 = space();
    			div11 = element("div");
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");
    			img0 = element("img");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			t4 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div4 = element("div");
    			div4.textContent = "We Engineer";
    			t6 = space();
    			div5 = element("div");
    			t7 = text("World Class ");
    			span0 = element("span");
    			span0.textContent = "Software";
    			t9 = space();
    			div6 = element("div");
    			div6.textContent = "Implementing latest technologies to transform\n                                our clients’ businesses by enabling seamless and\n                                highly interactive customer experiences.";
    			t11 = space();
    			a0 = element("a");
    			button0 = element("button");
    			button0.textContent = "Get in Touch";
    			t13 = space();
    			div10 = element("div");
    			t14 = space();
    			div26 = element("div");
    			div25 = element("div");
    			create_component(bubbles1.$$.fragment);
    			t15 = space();
    			div24 = element("div");
    			div14 = element("div");
    			t16 = space();
    			div15 = element("div");
    			img1 = element("img");
    			t17 = space();
    			div16 = element("div");
    			t18 = space();
    			div17 = element("div");
    			t19 = space();
    			div22 = element("div");
    			div21 = element("div");
    			div20 = element("div");
    			div18 = element("div");
    			t20 = text("Helping Business Success & Growth with ");
    			span1 = element("span");
    			span1.textContent = "Technology";
    			t22 = space();
    			div19 = element("div");
    			div19.textContent = "Implementing latest technologies to transform\n                                our clients’ businesses by enabling seamless and\n                                highly interactive customer experiences.";
    			t24 = space();
    			a1 = element("a");
    			button1 = element("button");
    			button1.textContent = "Get in Touch";
    			t26 = space();
    			div23 = element("div");
    			t27 = space();
    			div39 = element("div");
    			div38 = element("div");
    			create_component(bubbles2.$$.fragment);
    			t28 = space();
    			div37 = element("div");
    			div27 = element("div");
    			t29 = space();
    			div28 = element("div");
    			img2 = element("img");
    			t30 = space();
    			div29 = element("div");
    			t31 = space();
    			div30 = element("div");
    			t32 = space();
    			div35 = element("div");
    			div34 = element("div");
    			div33 = element("div");
    			div31 = element("div");
    			t33 = text("Global ");
    			span2 = element("span");
    			span2.textContent = "Payments";
    			t35 = text(" Solutions");
    			t36 = space();
    			div32 = element("div");
    			div32.textContent = "Our innovations and expertise drive growth for\n                                your company from ambitious startups to\n                                financial institutions and global enterprises.";
    			t38 = space();
    			a2 = element("a");
    			button2 = element("button");
    			button2.textContent = "Get in Touch";
    			t40 = space();
    			div36 = element("div");
    			t41 = space();
    			div52 = element("div");
    			div51 = element("div");
    			create_component(bubbles3.$$.fragment);
    			t42 = space();
    			div50 = element("div");
    			div40 = element("div");
    			t43 = space();
    			div41 = element("div");
    			img3 = element("img");
    			t44 = space();
    			div42 = element("div");
    			t45 = space();
    			div43 = element("div");
    			t46 = space();
    			div48 = element("div");
    			div47 = element("div");
    			div46 = element("div");
    			div44 = element("div");
    			span3 = element("span");
    			span3.textContent = "Fintech";
    			t48 = text(" software\n                                solutions");
    			t49 = space();
    			div45 = element("div");
    			div45.textContent = "We harness innovation and deliver an end-to-end\n                                experience that includes strategy, architecture,\n                                customer experience, service management - all\n                                within a new fintech ecosystem";
    			t51 = space();
    			a3 = element("a");
    			button3 = element("button");
    			button3.textContent = "Get in Touch";
    			t53 = space();
    			div49 = element("div");
    			t54 = space();
    			div65 = element("div");
    			div64 = element("div");
    			create_component(bubbles4.$$.fragment);
    			t55 = space();
    			div63 = element("div");
    			div53 = element("div");
    			t56 = space();
    			div54 = element("div");
    			img4 = element("img");
    			t57 = space();
    			div55 = element("div");
    			t58 = space();
    			div56 = element("div");
    			t59 = space();
    			div61 = element("div");
    			div60 = element("div");
    			div59 = element("div");
    			div57 = element("div");
    			span4 = element("span");
    			span4.textContent = "Blockchain";
    			t61 = text(" \n                                solutions for frictionless business");
    			t62 = space();
    			div58 = element("div");
    			div58.textContent = "Our blockchain platform can help transform the business lifecycle for digital ecosystems, while promoting trust, transparency and efficiency.";
    			t64 = space();
    			a4 = element("a");
    			button4 = element("button");
    			button4.textContent = "Get in Touch";
    			t66 = space();
    			div62 = element("div");
    			attr_dev(div0, "class", "column is-1 p-0");
    			add_location(div0, file$2, 13, 16, 444);
    			attr_dev(img0, "class", "carousel-img");
    			if (!src_url_equal(img0.src, img0_src_value = "/imgs/engineering.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "growth");
    			add_location(img0, file$2, 15, 20, 577);
    			attr_dev(div1, "class", "column is-4 has-text-centered");
    			set_style(div1, "padding", "1rem");
    			add_location(div1, file$2, 14, 16, 492);
    			attr_dev(div2, "class", "column is-1 p-0");
    			add_location(div2, file$2, 21, 16, 778);
    			attr_dev(div3, "class", "column is-1 p-0");
    			add_location(div3, file$2, 22, 16, 826);
    			attr_dev(div4, "class", "txt-white is-size-2 is-size-3-mobile roboto-mono p-2");
    			add_location(div4, file$2, 26, 28, 1058);
    			attr_dev(span0, "class", "txt-secondary");
    			add_location(span0, file$2, 34, 44, 1454);
    			attr_dev(div5, "class", "txt-white is-size-1 is-size-2-mobile p-2");
    			add_location(div5, file$2, 31, 28, 1293);
    			attr_dev(div6, "class", "txt-white is-size-5 p-2 ");
    			set_style(div6, "line-height", "2rem");
    			add_location(div6, file$2, 38, 28, 1631);
    			attr_dev(button0, "class", "button is-danger");
    			add_location(button0, file$2, 47, 33, 2140);
    			attr_dev(a0, "href", "#contact-us");
    			add_location(a0, file$2, 46, 28, 2085);
    			attr_dev(div7, "class", "vh-centerrm revealx");
    			add_location(div7, file$2, 25, 24, 996);
    			attr_dev(div8, "class", "center");
    			set_style(div8, "width", "100%");
    			set_style(div8, "height", "100%");
    			add_location(div8, file$2, 24, 20, 920);
    			attr_dev(div9, "class", "column is-4");
    			add_location(div9, file$2, 23, 16, 874);
    			attr_dev(div10, "class", "column is-1 p-0");
    			add_location(div10, file$2, 56, 16, 2487);
    			attr_dev(div11, "class", "columns m-0 p-0");
    			add_location(div11, file$2, 12, 12, 398);
    			attr_dev(div12, "style", "width:100%;height:100%;/*background: #010166;*/");
    			add_location(div12, file$2, 10, 8, 300);
    			attr_dev(div13, "class", "slide-content center");
    			add_location(div13, file$2, 9, 4, 257);
    			attr_dev(div14, "class", "column is-1 p-0");
    			add_location(div14, file$2, 64, 16, 2755);
    			attr_dev(img1, "class", "carousel-img");
    			if (!src_url_equal(img1.src, img1_src_value = "/imgs/business-growth.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "growth");
    			add_location(img1, file$2, 66, 20, 2888);
    			attr_dev(div15, "class", "column is-4 has-text-centered");
    			set_style(div15, "padding", "1rem");
    			add_location(div15, file$2, 65, 16, 2803);
    			attr_dev(div16, "class", "column is-1 p-0");
    			add_location(div16, file$2, 72, 16, 3093);
    			attr_dev(div17, "class", "column is-1 p-0");
    			add_location(div17, file$2, 73, 16, 3141);
    			attr_dev(span1, "class", "txt-secondary");
    			add_location(span1, file$2, 80, 71, 3561);
    			attr_dev(div18, "class", "txt-white is-size-2 is-size-3-mobile p-2");
    			add_location(div18, file$2, 77, 28, 3373);
    			attr_dev(div19, "class", "txt-white is-size-5 p-2 ");
    			set_style(div19, "line-height", "2rem");
    			add_location(div19, file$2, 84, 28, 3739);
    			attr_dev(button1, "class", "button is-danger");
    			add_location(button1, file$2, 93, 33, 4248);
    			attr_dev(a1, "href", "#contact-us");
    			add_location(a1, file$2, 92, 28, 4193);
    			attr_dev(div20, "class", "vh-centerrm revealx");
    			add_location(div20, file$2, 76, 24, 3311);
    			attr_dev(div21, "class", "center");
    			set_style(div21, "width", "100%");
    			set_style(div21, "height", "100%");
    			add_location(div21, file$2, 75, 20, 3235);
    			attr_dev(div22, "class", "column is-4");
    			add_location(div22, file$2, 74, 16, 3189);
    			attr_dev(div23, "class", "column is-1 p-0");
    			add_location(div23, file$2, 102, 16, 4595);
    			attr_dev(div24, "class", "columns m-0 p-0");
    			add_location(div24, file$2, 63, 12, 2709);
    			attr_dev(div25, "style", "width:100%;height:100%;/*background: #010166;*/");
    			add_location(div25, file$2, 61, 8, 2611);
    			attr_dev(div26, "class", "slide-content center");
    			add_location(div26, file$2, 60, 4, 2568);
    			attr_dev(div27, "class", "column is-1 p-0");
    			add_location(div27, file$2, 110, 16, 4863);
    			attr_dev(img2, "class", "carousel-img");
    			if (!src_url_equal(img2.src, img2_src_value = "/imgs/gb2.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "growth");
    			add_location(img2, file$2, 112, 20, 4996);
    			attr_dev(div28, "class", "column is-4 has-text-centered");
    			set_style(div28, "padding", "0rem");
    			add_location(div28, file$2, 111, 16, 4911);
    			attr_dev(div29, "class", "column is-1 p-0");
    			add_location(div29, file$2, 118, 16, 5189);
    			attr_dev(div30, "class", "column is-1 p-0");
    			add_location(div30, file$2, 119, 16, 5237);
    			attr_dev(span2, "class", "txt-secondary");
    			add_location(span2, file$2, 126, 39, 5625);
    			attr_dev(div31, "class", "txt-white is-size-2 is-size-3-mobile p-2");
    			add_location(div31, file$2, 123, 28, 5469);
    			attr_dev(div32, "class", "txt-white is-size-5 p-2 ");
    			set_style(div32, "line-height", "2rem");
    			add_location(div32, file$2, 130, 28, 5812);
    			attr_dev(button2, "class", "button is-danger");
    			add_location(button2, file$2, 139, 33, 6319);
    			attr_dev(a2, "href", "#contact-us");
    			add_location(a2, file$2, 138, 28, 6264);
    			attr_dev(div33, "class", "vh-centerrm revealx");
    			add_location(div33, file$2, 122, 24, 5407);
    			attr_dev(div34, "class", "center");
    			set_style(div34, "width", "100%");
    			set_style(div34, "height", "100%");
    			add_location(div34, file$2, 121, 20, 5331);
    			attr_dev(div35, "class", "column is-4");
    			add_location(div35, file$2, 120, 16, 5285);
    			attr_dev(div36, "class", "column is-1 p-0");
    			add_location(div36, file$2, 148, 16, 6666);
    			attr_dev(div37, "class", "columns m-0 p-0");
    			add_location(div37, file$2, 109, 12, 4817);
    			attr_dev(div38, "style", "width:100%;height:100%;/*background: #010166;*/");
    			add_location(div38, file$2, 107, 8, 4719);
    			attr_dev(div39, "class", "slide-content center");
    			add_location(div39, file$2, 106, 4, 4676);
    			attr_dev(div40, "class", "column is-1 p-0");
    			add_location(div40, file$2, 157, 16, 6935);
    			attr_dev(img3, "class", "carousel-img");
    			if (!src_url_equal(img3.src, img3_src_value = "/imgs/fintech.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "growth");
    			add_location(img3, file$2, 159, 20, 7068);
    			attr_dev(div41, "class", "column is-4 has-text-centered");
    			set_style(div41, "padding", "0rem");
    			add_location(div41, file$2, 158, 16, 6983);
    			attr_dev(div42, "class", "column is-1 p-0");
    			add_location(div42, file$2, 165, 16, 7265);
    			attr_dev(div43, "class", "column is-1 p-0");
    			add_location(div43, file$2, 166, 16, 7313);
    			attr_dev(span3, "class", "txt-secondary");
    			add_location(span3, file$2, 173, 32, 7694);
    			attr_dev(div44, "class", "txt-white is-size-2 is-size-3-mobile p-2");
    			add_location(div44, file$2, 170, 28, 7545);
    			attr_dev(div45, "class", "txt-white is-size-5 p-2 ");
    			set_style(div45, "line-height", "2rem");
    			add_location(div45, file$2, 176, 28, 7851);
    			attr_dev(button3, "class", "button is-danger");
    			add_location(button3, file$2, 186, 33, 8430);
    			attr_dev(a3, "href", "#contact-us");
    			add_location(a3, file$2, 185, 28, 8375);
    			attr_dev(div46, "class", "vh-centerrm revealx");
    			add_location(div46, file$2, 169, 24, 7483);
    			attr_dev(div47, "class", "center");
    			set_style(div47, "width", "100%");
    			set_style(div47, "height", "100%");
    			add_location(div47, file$2, 168, 20, 7407);
    			attr_dev(div48, "class", "column is-4");
    			add_location(div48, file$2, 167, 16, 7361);
    			attr_dev(div49, "class", "column is-1 p-0");
    			add_location(div49, file$2, 195, 16, 8777);
    			attr_dev(div50, "class", "columns m-0 p-0");
    			add_location(div50, file$2, 156, 12, 6889);
    			attr_dev(div51, "style", "width:100%;height:100%;/*background: #010166;*/");
    			add_location(div51, file$2, 154, 8, 6791);
    			attr_dev(div52, "class", "slide-content center");
    			add_location(div52, file$2, 153, 4, 6748);
    			attr_dev(div53, "class", "column is-1 p-0");
    			add_location(div53, file$2, 203, 16, 9045);
    			attr_dev(img4, "class", "carousel-img");
    			if (!src_url_equal(img4.src, img4_src_value = "/imgs/blockchain.png")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "growth");
    			add_location(img4, file$2, 205, 20, 9178);
    			attr_dev(div54, "class", "column is-4 has-text-centered");
    			set_style(div54, "padding", "0rem");
    			add_location(div54, file$2, 204, 16, 9093);
    			attr_dev(div55, "class", "column is-1 p-0");
    			add_location(div55, file$2, 211, 16, 9378);
    			attr_dev(div56, "class", "column is-1 p-0");
    			add_location(div56, file$2, 212, 16, 9426);
    			attr_dev(span4, "class", "txt-secondary");
    			add_location(span4, file$2, 219, 32, 9807);
    			attr_dev(div57, "class", "txt-white is-size-2 is-size-3-mobile p-2");
    			add_location(div57, file$2, 216, 28, 9658);
    			attr_dev(div58, "class", "txt-white is-size-5 p-2 ");
    			set_style(div58, "line-height", "2rem");
    			add_location(div58, file$2, 222, 28, 9985);
    			attr_dev(button4, "class", "button is-danger");
    			add_location(button4, file$2, 229, 33, 10432);
    			attr_dev(a4, "href", "#contact-us");
    			add_location(a4, file$2, 228, 28, 10377);
    			attr_dev(div59, "class", "vh-centerrm revealx");
    			add_location(div59, file$2, 215, 24, 9596);
    			attr_dev(div60, "class", "center");
    			set_style(div60, "width", "100%");
    			set_style(div60, "height", "100%");
    			add_location(div60, file$2, 214, 20, 9520);
    			attr_dev(div61, "class", "column is-4");
    			add_location(div61, file$2, 213, 16, 9474);
    			attr_dev(div62, "class", "column is-1 p-0");
    			add_location(div62, file$2, 238, 16, 10779);
    			attr_dev(div63, "class", "columns m-0 p-0");
    			add_location(div63, file$2, 202, 12, 8999);
    			attr_dev(div64, "style", "width:100%;height:100%;/*background: #010166;*/");
    			add_location(div64, file$2, 200, 8, 8901);
    			attr_dev(div65, "class", "slide-content center");
    			add_location(div65, file$2, 199, 4, 8858);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div13, anchor);
    			append_dev(div13, div12);
    			mount_component(bubbles0, div12, null);
    			append_dev(div12, t0);
    			append_dev(div12, div11);
    			append_dev(div11, div0);
    			append_dev(div11, t1);
    			append_dev(div11, div1);
    			append_dev(div1, img0);
    			append_dev(div11, t2);
    			append_dev(div11, div2);
    			append_dev(div11, t3);
    			append_dev(div11, div3);
    			append_dev(div11, t4);
    			append_dev(div11, div9);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div4);
    			append_dev(div7, t6);
    			append_dev(div7, div5);
    			append_dev(div5, t7);
    			append_dev(div5, span0);
    			append_dev(div7, t9);
    			append_dev(div7, div6);
    			append_dev(div7, t11);
    			append_dev(div7, a0);
    			append_dev(a0, button0);
    			append_dev(div11, t13);
    			append_dev(div11, div10);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div26, anchor);
    			append_dev(div26, div25);
    			mount_component(bubbles1, div25, null);
    			append_dev(div25, t15);
    			append_dev(div25, div24);
    			append_dev(div24, div14);
    			append_dev(div24, t16);
    			append_dev(div24, div15);
    			append_dev(div15, img1);
    			append_dev(div24, t17);
    			append_dev(div24, div16);
    			append_dev(div24, t18);
    			append_dev(div24, div17);
    			append_dev(div24, t19);
    			append_dev(div24, div22);
    			append_dev(div22, div21);
    			append_dev(div21, div20);
    			append_dev(div20, div18);
    			append_dev(div18, t20);
    			append_dev(div18, span1);
    			append_dev(div20, t22);
    			append_dev(div20, div19);
    			append_dev(div20, t24);
    			append_dev(div20, a1);
    			append_dev(a1, button1);
    			append_dev(div24, t26);
    			append_dev(div24, div23);
    			insert_dev(target, t27, anchor);
    			insert_dev(target, div39, anchor);
    			append_dev(div39, div38);
    			mount_component(bubbles2, div38, null);
    			append_dev(div38, t28);
    			append_dev(div38, div37);
    			append_dev(div37, div27);
    			append_dev(div37, t29);
    			append_dev(div37, div28);
    			append_dev(div28, img2);
    			append_dev(div37, t30);
    			append_dev(div37, div29);
    			append_dev(div37, t31);
    			append_dev(div37, div30);
    			append_dev(div37, t32);
    			append_dev(div37, div35);
    			append_dev(div35, div34);
    			append_dev(div34, div33);
    			append_dev(div33, div31);
    			append_dev(div31, t33);
    			append_dev(div31, span2);
    			append_dev(div31, t35);
    			append_dev(div33, t36);
    			append_dev(div33, div32);
    			append_dev(div33, t38);
    			append_dev(div33, a2);
    			append_dev(a2, button2);
    			append_dev(div37, t40);
    			append_dev(div37, div36);
    			insert_dev(target, t41, anchor);
    			insert_dev(target, div52, anchor);
    			append_dev(div52, div51);
    			mount_component(bubbles3, div51, null);
    			append_dev(div51, t42);
    			append_dev(div51, div50);
    			append_dev(div50, div40);
    			append_dev(div50, t43);
    			append_dev(div50, div41);
    			append_dev(div41, img3);
    			append_dev(div50, t44);
    			append_dev(div50, div42);
    			append_dev(div50, t45);
    			append_dev(div50, div43);
    			append_dev(div50, t46);
    			append_dev(div50, div48);
    			append_dev(div48, div47);
    			append_dev(div47, div46);
    			append_dev(div46, div44);
    			append_dev(div44, span3);
    			append_dev(div44, t48);
    			append_dev(div46, t49);
    			append_dev(div46, div45);
    			append_dev(div46, t51);
    			append_dev(div46, a3);
    			append_dev(a3, button3);
    			append_dev(div50, t53);
    			append_dev(div50, div49);
    			insert_dev(target, t54, anchor);
    			insert_dev(target, div65, anchor);
    			append_dev(div65, div64);
    			mount_component(bubbles4, div64, null);
    			append_dev(div64, t55);
    			append_dev(div64, div63);
    			append_dev(div63, div53);
    			append_dev(div63, t56);
    			append_dev(div63, div54);
    			append_dev(div54, img4);
    			append_dev(div63, t57);
    			append_dev(div63, div55);
    			append_dev(div63, t58);
    			append_dev(div63, div56);
    			append_dev(div63, t59);
    			append_dev(div63, div61);
    			append_dev(div61, div60);
    			append_dev(div60, div59);
    			append_dev(div59, div57);
    			append_dev(div57, span4);
    			append_dev(div57, t61);
    			append_dev(div59, t62);
    			append_dev(div59, div58);
    			append_dev(div59, t64);
    			append_dev(div59, a4);
    			append_dev(a4, button4);
    			append_dev(div63, t66);
    			append_dev(div63, div62);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false),
    					listen_dev(button2, "click", click_handler_2, false, false, false),
    					listen_dev(button3, "click", click_handler_3, false, false, false),
    					listen_dev(button4, "click", click_handler_4, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop$1,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bubbles0.$$.fragment, local);
    			transition_in(bubbles1.$$.fragment, local);
    			transition_in(bubbles2.$$.fragment, local);
    			transition_in(bubbles3.$$.fragment, local);
    			transition_in(bubbles4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bubbles0.$$.fragment, local);
    			transition_out(bubbles1.$$.fragment, local);
    			transition_out(bubbles2.$$.fragment, local);
    			transition_out(bubbles3.$$.fragment, local);
    			transition_out(bubbles4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div13);
    			destroy_component(bubbles0);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div26);
    			destroy_component(bubbles1);
    			if (detaching) detach_dev(t27);
    			if (detaching) detach_dev(div39);
    			destroy_component(bubbles2);
    			if (detaching) detach_dev(t41);
    			if (detaching) detach_dev(div52);
    			destroy_component(bubbles3);
    			if (detaching) detach_dev(t54);
    			if (detaching) detach_dev(div65);
    			destroy_component(bubbles4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(7:0) <Carousel perPage={1} autoplay={3500}>",
    		ctx
    	});

    	return block;
    }

    // (8:4) 
    function create_left_control_slot$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "control");
    			attr_dev(span, "slot", "left-control");
    			add_location(span, file$2, 7, 4, 207);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_left_control_slot$1.name,
    		type: "slot",
    		source: "(8:4) ",
    		ctx
    	});

    	return block;
    }

    // (243:4) 
    function create_right_control_slot$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "control");
    			attr_dev(span, "slot", "right-control");
    			add_location(span, file$2, 242, 4, 10860);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_right_control_slot$1.name,
    		type: "slot",
    		source: "(243:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let carousel;
    	let current;

    	carousel = new Carousel({
    			props: {
    				perPage: 1,
    				autoplay: 3500,
    				$$slots: {
    					"right-control": [create_right_control_slot$1],
    					"left-control": [create_left_control_slot$1],
    					default: [create_default_slot$1]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(carousel.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(carousel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const carousel_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				carousel_changes.$$scope = { dirty, ctx };
    			}

    			carousel.$set(carousel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(carousel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(carousel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(carousel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const click_handler = () => {
    	
    };

    const click_handler_1 = () => {
    	
    };

    const click_handler_2 = () => {
    	
    };

    const click_handler_3 = () => {
    	
    };

    const click_handler_4 = () => {
    	
    };

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Carousel', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Carousel> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Bubbles, Carousel, reveal });
    	return [];
    }

    class Carousel_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal$1, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Carousel_1",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/home/desktop.svelte generated by Svelte v3.46.4 */

    const { console: console_1, window: window_1 } = globals;
    const file$1 = "src/home/desktop.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	return child_ctx;
    }

    // (172:12) {#each slides1 as slide_data}
    function create_each_block(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let div1;
    	let t1_value = /*slide_data*/ ctx[31][1] + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			if (!src_url_equal(img.src, img_src_value = /*slide_data*/ ctx[31][0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "img-height");
    			attr_dev(img, "alt", "image1");
    			add_location(img, file$1, 175, 28, 6120);
    			set_style(div0, "width", "40%");
    			attr_dev(div0, "class", "px-2");
    			add_location(div0, file$1, 174, 24, 6055);
    			set_style(div1, "width", "60%");
    			attr_dev(div1, "class", "center txt-white is-size-5");
    			add_location(div1, file$1, 181, 24, 6359);
    			set_style(div2, "width", "100%");
    			set_style(div2, "display", "flex");
    			add_location(div2, file$1, 173, 20, 5993);
    			attr_dev(div3, "class", "slide-content center");
    			set_style(div3, "padding", "5px");
    			add_location(div3, file$1, 172, 16, 5918);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, img);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, t1);
    			append_dev(div3, t2);
    		},
    		p: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(172:12) {#each slides1 as slide_data}",
    		ctx
    	});

    	return block;
    }

    // (165:8) <Carousel             perPage={{ 1000: 6, 800: 4, 500: 3, 100: 2 }}             autoplay={3500}             dots={false}             duration={1000}         >
    function create_default_slot(ctx) {
    	let each_1_anchor;
    	let each_value = /*slides1*/ ctx[11];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*slides1*/ 2048) {
    				each_value = /*slides1*/ ctx[11];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(165:8) <Carousel             perPage={{ 1000: 6, 800: 4, 500: 3, 100: 2 }}             autoplay={3500}             dots={false}             duration={1000}         >",
    		ctx
    	});

    	return block;
    }

    // (171:12) 
    function create_left_control_slot(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "control");
    			attr_dev(span, "slot", "left-control");
    			add_location(span, file$1, 170, 12, 5815);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_left_control_slot.name,
    		type: "slot",
    		source: "(171:12) ",
    		ctx
    	});

    	return block;
    }

    // (192:12) 
    function create_right_control_slot(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "control");
    			attr_dev(span, "slot", "right-control");
    			add_location(span, file$1, 191, 12, 6657);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_right_control_slot.name,
    		type: "slot",
    		source: "(192:12) ",
    		ctx
    	});

    	return block;
    }

    // (270:12) {#if show_reveal}
    function create_if_block_4(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let span;
    	let t2;
    	let div2;
    	let div1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text("Modern Mobile ");
    			span = element("span");
    			span.textContent = "Apps";
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div1.textContent = "Our Highly interactive mobile apps across platforms\n                            empowers you to scale your business and create a\n                            lasting experience for your users";
    			attr_dev(span, "class", "txt-secondary");
    			add_location(span, file$1, 272, 38, 10539);
    			attr_dev(div0, "class", "is-size-2 txt-white p-2");
    			add_location(div0, file$1, 271, 20, 10461);
    			attr_dev(div1, "class", "is-size-5 roboto-mono txt-white");
    			attr_dev(div1, "style", "");
    			add_location(div1, file$1, 276, 24, 10675);
    			attr_dev(div2, "class", "py-4 px-2");
    			add_location(div2, file$1, 275, 20, 10627);
    			attr_dev(div3, "class", "vh-centerrm");
    			add_location(div3, file$1, 270, 16, 10404);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div0, span);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, div1);

    			if (!mounted) {
    				dispose = action_destroyer(reveal.call(null, div3));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(270:12) {#if show_reveal}",
    		ctx
    	});

    	return block;
    }

    // (316:12) {#if show_reveal}
    function create_if_block_3(ctx) {
    	let div8;
    	let div5;
    	let div4;
    	let span0;
    	let t1;
    	let span3;
    	let span2;
    	let span1;
    	let div0;
    	let t3;
    	let div1;
    	let t5;
    	let div2;
    	let t7;
    	let div3;
    	let t9;
    	let div7;
    	let div6;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			span0 = element("span");
    			span0.textContent = "Fintech";
    			t1 = space();
    			span3 = element("span");
    			span2 = element("span");
    			span1 = element("span");
    			div0 = element("div");
    			div0.textContent = "Solutions";
    			t3 = space();
    			div1 = element("div");
    			div1.textContent = "Expertise";
    			t5 = space();
    			div2 = element("div");
    			div2.textContent = "Solutions";
    			t7 = space();
    			div3 = element("div");
    			div3.textContent = "Expertise";
    			t9 = space();
    			div7 = element("div");
    			div6 = element("div");
    			div6.textContent = "We Develop Blazingly Fast and Responsive Websites\n                            based on Modern Design principles with hyper focus\n                            on user experiences across all platforms";
    			attr_dev(span0, "class", "content__container__text");
    			add_location(span0, file$1, 321, 28, 12373);
    			attr_dev(div0, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div0, file$1, 330, 40, 12884);
    			attr_dev(div1, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div1, file$1, 335, 40, 13160);
    			attr_dev(div2, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div2, file$1, 340, 40, 13436);
    			attr_dev(div3, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div3, file$1, 345, 40, 13712);
    			attr_dev(span1, "class", "content__container__list txt-secondary svelte-1fkwxqr");
    			set_style(span1, "display", "block");
    			add_location(span1, file$1, 326, 36, 12651);
    			set_style(span2, "position", "absolute");
    			add_location(span2, file$1, 325, 33, 12582);
    			set_style(span3, "position", "relative");
    			add_location(span3, file$1, 324, 28, 12517);
    			set_style(div4, "width", "100%");
    			set_style(div4, "overflow", "hidden");
    			set_style(div4, "padding-bottom", "0.4rem");
    			add_location(div4, file$1, 318, 24, 12227);
    			attr_dev(div5, "class", "is-size-2 is-size-3-mobile p-2 txt-white ");
    			add_location(div5, file$1, 317, 20, 12145);
    			attr_dev(div6, "class", "is-size-5 txt-white roboto-mono");
    			attr_dev(div6, "style", "");
    			add_location(div6, file$1, 357, 24, 14196);
    			attr_dev(div7, "class", "py-4 px-2 ");
    			add_location(div7, file$1, 356, 20, 14147);
    			attr_dev(div8, "class", "vh-centerrm");
    			add_location(div8, file$1, 316, 16, 12088);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div5);
    			append_dev(div5, div4);
    			append_dev(div4, span0);
    			append_dev(div4, t1);
    			append_dev(div4, span3);
    			append_dev(span3, span2);
    			append_dev(span2, span1);
    			append_dev(span1, div0);
    			append_dev(span1, t3);
    			append_dev(span1, div1);
    			append_dev(span1, t5);
    			append_dev(span1, div2);
    			append_dev(span1, t7);
    			append_dev(span1, div3);
    			append_dev(div8, t9);
    			append_dev(div8, div7);
    			append_dev(div7, div6);

    			if (!mounted) {
    				dispose = action_destroyer(reveal.call(null, div8));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(316:12) {#if show_reveal}",
    		ctx
    	});

    	return block;
    }

    // (374:12) {#if show_reveal}
    function create_if_block_2(ctx) {
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Enterprise Automation";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Automate all your business processes on the go from\n                        Business Accounting and Contracts Mangements to Customer\n                        and Staff Management and communication with our Software\n                        expertise";
    			attr_dev(div0, "class", "is-size-2 p-2 txt-secondary");
    			add_location(div0, file$1, 375, 20, 14907);
    			attr_dev(div1, "class", "is-size-5 p-2");
    			add_location(div1, file$1, 379, 20, 15045);
    			attr_dev(div2, "class", "vh-centerrm");
    			add_location(div2, file$1, 374, 16, 14850);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);

    			if (!mounted) {
    				dispose = action_destroyer(reveal.call(null, div2));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(374:12) {#if show_reveal}",
    		ctx
    	});

    	return block;
    }

    // (414:12) {#if show_reveal}
    function create_if_block_1(ctx) {
    	let div4;
    	let div1;
    	let div0;
    	let span1;
    	let span0;
    	let t1;
    	let t2;
    	let div3;
    	let div2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span1 = element("span");
    			span0 = element("span");
    			span0.textContent = "Blockchain";
    			t1 = text(" Solutions");
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div2.textContent = "With advancements in Distributed Ledger Technology\n                            (DLT), various industries are leveraging it to\n                            eliminate intermediaries from legal and financial\n                            transactions. Popularly known as Blockchain, the\n                            technology helps store digital records in a secure\n                            and auditable manner, enabling a speedy, safe, and\n                            cost-effective transfer of assets.";
    			attr_dev(span0, "class", "txt-secondary");
    			add_location(span0, file$1, 420, 33, 16683);
    			attr_dev(span1, "class", "content__container__text ");
    			add_location(span1, file$1, 419, 28, 16610);
    			set_style(div0, "width", "100%");
    			set_style(div0, "overflow", "hidden");
    			set_style(div0, "padding-bottom", "0.4rem");
    			add_location(div0, file$1, 416, 24, 16464);
    			attr_dev(div1, "class", "is-size-2 is-size-3-mobile p-2 txt-white ");
    			add_location(div1, file$1, 415, 20, 16382);
    			attr_dev(div2, "class", "is-size-5 txt-white roboto-mono");
    			attr_dev(div2, "style", "");
    			add_location(div2, file$1, 426, 24, 16903);
    			attr_dev(div3, "class", "py-4 px-2 ");
    			add_location(div3, file$1, 425, 20, 16854);
    			attr_dev(div4, "class", "vh-centerrm");
    			add_location(div4, file$1, 414, 16, 16325);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, span1);
    			append_dev(span1, span0);
    			append_dev(span1, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div2);

    			if (!mounted) {
    				dispose = action_destroyer(reveal.call(null, div4));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(414:12) {#if show_reveal}",
    		ctx
    	});

    	return block;
    }

    // (459:12) {#if show_reveal}
    function create_if_block(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let span;
    	let t2;
    	let div1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text("Digital ");
    			span = element("span");
    			span.textContent = "Marketing";
    			t2 = space();
    			div1 = element("div");
    			div1.textContent = "Increase business Reach & Sales using our digital\n                        marketing expertise which is extensively Data driven\n                        maximizing engagement per capita.";
    			attr_dev(span, "class", "txt-secondary");
    			add_location(span, file$1, 461, 32, 18353);
    			attr_dev(div0, "class", "is-size-1 p-2 txt-white");
    			add_location(div0, file$1, 460, 20, 18281);
    			attr_dev(div1, "class", "is-size-4 p-2 txt-white");
    			add_location(div1, file$1, 464, 20, 18446);
    			attr_dev(div2, "class", "vh-centerrm");
    			add_location(div2, file$1, 459, 16, 18224);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, span);
    			append_dev(div2, t2);
    			append_dev(div2, div1);

    			if (!mounted) {
    				dispose = action_destroyer(reveal.call(null, div2));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(459:12) {#if show_reveal}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div89;
    	let div0;
    	let trade;
    	let t0;
    	let div1;
    	let carousel0;
    	let t1;
    	let div3;
    	let div2;
    	let t3;
    	let carousel1;
    	let t4;
    	let div6;
    	let div4;
    	let span0;
    	let t5;
    	let t6;
    	let div5;
    	let span1;
    	let t8;
    	let div21;
    	let div7;
    	let t9;
    	let div9;
    	let div8;
    	let img0;
    	let img0_src_value;
    	let t10;
    	let div19;
    	let div18;
    	let div15;
    	let div14;
    	let span2;
    	let t12;
    	let span5;
    	let span4;
    	let span3;
    	let div10;
    	let t14;
    	let div11;
    	let t16;
    	let div12;
    	let t18;
    	let div13;
    	let t20;
    	let div17;
    	let div16;
    	let t22;
    	let div20;
    	let t23;
    	let div28;
    	let div22;
    	let t24;
    	let div23;
    	let t25;
    	let div24;
    	let t26;
    	let div26;
    	let div25;
    	let img1;
    	let img1_src_value;
    	let t27;
    	let div27;
    	let t28;
    	let div34;
    	let div29;
    	let t29;
    	let div31;
    	let div30;
    	let img2;
    	let img2_src_value;
    	let t30;
    	let div32;
    	let t31;
    	let div33;
    	let t32;
    	let div40;
    	let div35;
    	let t33;
    	let div36;
    	let t34;
    	let div38;
    	let div37;
    	let img3;
    	let img3_src_value;
    	let t35;
    	let div39;
    	let t36;
    	let div46;
    	let div41;
    	let t37;
    	let div43;
    	let div42;
    	let img4;
    	let img4_src_value;
    	let t38;
    	let div44;
    	let t39;
    	let div45;
    	let t40;
    	let div52;
    	let div47;
    	let t41;
    	let div49;
    	let div48;
    	let img5;
    	let img5_src_value;
    	let t42;
    	let div50;
    	let t43;
    	let div51;
    	let t44;
    	let div84;
    	let div54;
    	let div53;
    	let t45;
    	let br;
    	let t46;
    	let t47;
    	let div83;
    	let div82;
    	let div81;
    	let div80;
    	let div61;
    	let div60;
    	let div59;
    	let div55;
    	let t49;
    	let div56;
    	let t51;
    	let div57;
    	let t53;
    	let div58;
    	let t55;
    	let div79;
    	let div68;
    	let div64;
    	let div63;
    	let label0;
    	let t57;
    	let div62;
    	let input0;
    	let t58;
    	let div67;
    	let div66;
    	let label1;
    	let t60;
    	let div65;
    	let input1;
    	let t61;
    	let div75;
    	let div71;
    	let div70;
    	let label2;
    	let t63;
    	let div69;
    	let input2;
    	let t64;
    	let div74;
    	let div73;
    	let label3;
    	let t66;
    	let div72;
    	let input3;
    	let t67;
    	let div77;
    	let label4;
    	let t69;
    	let div76;
    	let textarea;
    	let t70;
    	let div78;
    	let button0;
    	let t72;
    	let div88;
    	let div85;
    	let t73;
    	let div87;
    	let header;
    	let p;
    	let t74;
    	let t75;
    	let section;
    	let div86;
    	let t76;
    	let t77;
    	let footer;
    	let button1;
    	let t79;
    	let button2;
    	let div88_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	trade = new Trade({ $$inline: true });
    	carousel0 = new Carousel_1({ $$inline: true });

    	carousel1 = new Carousel({
    			props: {
    				perPage: { 1000: 6, 800: 4, 500: 3, 100: 2 },
    				autoplay: 3500,
    				dots: false,
    				duration: 1000,
    				$$slots: {
    					"right-control": [create_right_control_slot],
    					"left-control": [create_left_control_slot],
    					default: [create_default_slot]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	let if_block0 = /*show_reveal*/ ctx[0] && create_if_block_4(ctx);
    	let if_block1 = /*show_reveal*/ ctx[0] && create_if_block_3(ctx);
    	let if_block2 = /*show_reveal*/ ctx[0] && create_if_block_2(ctx);
    	let if_block3 = /*show_reveal*/ ctx[0] && create_if_block_1(ctx);
    	let if_block4 = /*show_reveal*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div89 = element("div");
    			div0 = element("div");
    			create_component(trade.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			create_component(carousel0.$$.fragment);
    			t1 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div2.textContent = "OUR SERVICES";
    			t3 = space();
    			create_component(carousel1.$$.fragment);
    			t4 = space();
    			div6 = element("div");
    			div4 = element("div");
    			span0 = element("span");
    			t5 = text("GO BIGGER!");
    			t6 = space();
    			div5 = element("div");
    			span1 = element("span");
    			span1.textContent = "With WESICS";
    			t8 = space();
    			div21 = element("div");
    			div7 = element("div");
    			t9 = space();
    			div9 = element("div");
    			div8 = element("div");
    			img0 = element("img");
    			t10 = space();
    			div19 = element("div");
    			div18 = element("div");
    			div15 = element("div");
    			div14 = element("div");
    			span2 = element("span");
    			span2.textContent = "Website";
    			t12 = space();
    			span5 = element("span");
    			span4 = element("span");
    			span3 = element("span");
    			div10 = element("div");
    			div10.textContent = "Development";
    			t14 = space();
    			div11 = element("div");
    			div11.textContent = "Designing";
    			t16 = space();
    			div12 = element("div");
    			div12.textContent = "Development";
    			t18 = space();
    			div13 = element("div");
    			div13.textContent = "Designing";
    			t20 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div16.textContent = "We Develop Blazingly Fast and Responsive Websites based\n                        on Modern Design principles with hyper focus on user\n                        experiences across all platforms";
    			t22 = space();
    			div20 = element("div");
    			t23 = space();
    			div28 = element("div");
    			div22 = element("div");
    			t24 = space();
    			div23 = element("div");
    			if (if_block0) if_block0.c();
    			t25 = space();
    			div24 = element("div");
    			t26 = space();
    			div26 = element("div");
    			div25 = element("div");
    			img1 = element("img");
    			t27 = space();
    			div27 = element("div");
    			t28 = space();
    			div34 = element("div");
    			div29 = element("div");
    			t29 = space();
    			div31 = element("div");
    			div30 = element("div");
    			img2 = element("img");
    			t30 = space();
    			div32 = element("div");
    			if (if_block1) if_block1.c();
    			t31 = space();
    			div33 = element("div");
    			t32 = space();
    			div40 = element("div");
    			div35 = element("div");
    			t33 = space();
    			div36 = element("div");
    			if (if_block2) if_block2.c();
    			t34 = space();
    			div38 = element("div");
    			div37 = element("div");
    			img3 = element("img");
    			t35 = space();
    			div39 = element("div");
    			t36 = space();
    			div46 = element("div");
    			div41 = element("div");
    			t37 = space();
    			div43 = element("div");
    			div42 = element("div");
    			img4 = element("img");
    			t38 = space();
    			div44 = element("div");
    			if (if_block3) if_block3.c();
    			t39 = space();
    			div45 = element("div");
    			t40 = space();
    			div52 = element("div");
    			div47 = element("div");
    			t41 = space();
    			div49 = element("div");
    			div48 = element("div");
    			img5 = element("img");
    			t42 = space();
    			div50 = element("div");
    			if (if_block4) if_block4.c();
    			t43 = space();
    			div51 = element("div");
    			t44 = space();
    			div84 = element("div");
    			div54 = element("div");
    			div53 = element("div");
    			t45 = text("Don't Hesitate To Contact Us For ");
    			br = element("br");
    			t46 = text(" Better Information And Services");
    			t47 = space();
    			div83 = element("div");
    			div82 = element("div");
    			div81 = element("div");
    			div80 = element("div");
    			div61 = element("div");
    			div60 = element("div");
    			div59 = element("div");
    			div55 = element("div");
    			div55.textContent = "Have Any Questions?";
    			t49 = space();
    			div56 = element("div");
    			div56.textContent = "Need Free Consulation?";
    			t51 = space();
    			div57 = element("div");
    			div57.textContent = "Don't Hesitate";
    			t53 = space();
    			div58 = element("div");
    			div58.textContent = "Contact Us!";
    			t55 = space();
    			div79 = element("div");
    			div68 = element("div");
    			div64 = element("div");
    			div63 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name";
    			t57 = space();
    			div62 = element("div");
    			input0 = element("input");
    			t58 = space();
    			div67 = element("div");
    			div66 = element("div");
    			label1 = element("label");
    			label1.textContent = "Phone";
    			t60 = space();
    			div65 = element("div");
    			input1 = element("input");
    			t61 = space();
    			div75 = element("div");
    			div71 = element("div");
    			div70 = element("div");
    			label2 = element("label");
    			label2.textContent = "Email";
    			t63 = space();
    			div69 = element("div");
    			input2 = element("input");
    			t64 = space();
    			div74 = element("div");
    			div73 = element("div");
    			label3 = element("label");
    			label3.textContent = "Subject";
    			t66 = space();
    			div72 = element("div");
    			input3 = element("input");
    			t67 = space();
    			div77 = element("div");
    			label4 = element("label");
    			label4.textContent = "Message";
    			t69 = space();
    			div76 = element("div");
    			textarea = element("textarea");
    			t70 = space();
    			div78 = element("div");
    			button0 = element("button");
    			button0.textContent = "Send Message";
    			t72 = space();
    			div88 = element("div");
    			div85 = element("div");
    			t73 = space();
    			div87 = element("div");
    			header = element("header");
    			p = element("p");
    			t74 = text(/*modal_title*/ ctx[5]);
    			t75 = space();
    			section = element("section");
    			div86 = element("div");
    			t76 = text(/*modal_message*/ ctx[4]);
    			t77 = space();
    			footer = element("footer");
    			button1 = element("button");
    			button1.textContent = "Close";
    			t79 = space();
    			button2 = element("button");
    			add_location(div0, file$1, 151, 0, 5359);
    			attr_dev(div1, "style", "");
    			add_location(div1, file$1, 156, 4, 5410);
    			attr_dev(div2, "class", "section center px-5 is-size-3 txt-secondary");
    			add_location(div2, file$1, 161, 8, 5537);
    			attr_dev(div3, "style", "/*background-color:#010166;*/width:100%");
    			attr_dev(div3, "class", "py-2");
    			add_location(div3, file$1, 160, 4, 5462);
    			attr_dev(span0, "class", "pilot-green-gradient  svelte-1fkwxqr");
    			attr_dev(span0, "id", "go_big_grad_text");
    			set_style(span0, "font-family", "'Josefin Sans', sans-serif");

    			set_style(span0, "font-size", /*big_text_size*/ ctx[2] == null
    			? "2.5rem"
    			: /*big_text_size*/ ctx[2]);

    			add_location(span0, file$1, 196, 12, 6877);
    			attr_dev(div4, "class", "has-text-centered py-4 ");
    			add_location(div4, file$1, 195, 8, 6803);
    			set_style(span1, "font-family", "'Josefin Sans', sans-serif");
    			attr_dev(span1, "class", "is-size-1 is-size-3-mobile is-size-2-tablet pilot-green-gradient svelte-1fkwxqr");
    			add_location(span1, file$1, 198, 46, 7121);
    			attr_dev(div5, "class", "has-text-centered ");
    			add_location(div5, file$1, 198, 12, 7087);
    			attr_dev(div6, "class", "column");
    			add_location(div6, file$1, 194, 4, 6738);
    			attr_dev(div7, "class", "column is-1 p-0");
    			add_location(div7, file$1, 202, 8, 7396);
    			if (!src_url_equal(img0.src, img0_src_value = "/imgs/web-development1.png")) attr_dev(img0, "src", img0_src_value);
    			set_style(img0, "max-width", "100%");
    			set_style(img0, "height", "auto");
    			set_style(img0, "width", "100%");
    			attr_dev(img0, "alt", "growth");
    			add_location(img0, file$1, 207, 16, 7613);
    			set_style(div8, "padding", "1rem");
    			set_style(div8, "background-color", "#011566");
    			set_style(div8, "border-radius", "50rem");
    			add_location(div8, file$1, 204, 12, 7492);
    			attr_dev(div9, "class", "column is-3 has-text-centered");
    			add_location(div9, file$1, 203, 8, 7436);
    			attr_dev(span2, "class", "content__container__text");
    			add_location(span2, file$1, 221, 24, 8160);
    			attr_dev(div10, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div10, file$1, 228, 36, 8581);
    			attr_dev(div11, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div11, file$1, 233, 36, 8839);
    			attr_dev(div12, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div12, file$1, 238, 36, 9095);
    			attr_dev(div13, "class", "content__container__list__item pb-1 svelte-1fkwxqr");
    			add_location(div13, file$1, 243, 36, 9353);
    			attr_dev(span3, "class", "content__container__list txt-secondary svelte-1fkwxqr");
    			set_style(span3, "display", "block");
    			add_location(span3, file$1, 224, 32, 8364);
    			set_style(span4, "position", "absolute");
    			add_location(span4, file$1, 223, 29, 8299);
    			set_style(span5, "position", "relative");
    			add_location(span5, file$1, 222, 24, 8238);
    			set_style(div14, "width", "100%");
    			set_style(div14, "overflow", "hidden");
    			set_style(div14, "padding-bottom", "0.4rem");
    			add_location(div14, file$1, 218, 20, 8026);
    			attr_dev(div15, "class", "is-size-2 is-size-3-mobile p-2 txt-white ");
    			add_location(div15, file$1, 217, 16, 7948);
    			attr_dev(div16, "class", "is-size-5 txt-white roboto-mono");
    			attr_dev(div16, "style", "");
    			add_location(div16, file$1, 255, 20, 9793);
    			attr_dev(div17, "class", "py-4 px-2 ");
    			add_location(div17, file$1, 254, 16, 9748);
    			attr_dev(div18, "class", "vh-centerrm");
    			add_location(div18, file$1, 216, 12, 7895);
    			attr_dev(div19, "class", "column is-6 center pl-5 rrma center");
    			add_location(div19, file$1, 215, 8, 7833);
    			attr_dev(div20, "class", "column is-1 p-0");
    			add_location(div20, file$1, 263, 8, 10154);
    			attr_dev(div21, "class", "columns m-0 p-0 pt-5 pb-5");
    			attr_dev(div21, "style", "/*background-color:#00A2AD*/");
    			add_location(div21, file$1, 201, 4, 7311);
    			attr_dev(div22, "class", "column is-1 p-0");
    			add_location(div22, file$1, 267, 8, 10285);
    			attr_dev(div23, "class", "column is-5 center");
    			add_location(div23, file$1, 268, 8, 10325);
    			attr_dev(div24, "class", "column is-1 center");
    			add_location(div24, file$1, 286, 8, 11072);
    			if (!src_url_equal(img1.src, img1_src_value = "/imgs/mobile-app-development.png")) attr_dev(img1, "src", img1_src_value);
    			set_style(img1, "max-width", "100%");
    			set_style(img1, "height", "auto");
    			set_style(img1, "width", "100%");
    			attr_dev(img1, "alt", "growth");
    			add_location(img1, file$1, 291, 16, 11292);
    			set_style(div25, "padding", "1rem");
    			set_style(div25, "background-color", "#011566");
    			set_style(div25, "border-radius", "50rem");
    			add_location(div25, file$1, 288, 12, 11171);
    			attr_dev(div26, "class", "column is-3 has-text-centered");
    			add_location(div26, file$1, 287, 8, 11115);
    			attr_dev(div27, "class", "column is-1 p-0");
    			add_location(div27, file$1, 299, 8, 11518);
    			attr_dev(div28, "class", "columns m-0 p-0 pt-5 pb-5");
    			set_style(div28, "background-color", "#ffbd5a");
    			add_location(div28, file$1, 266, 4, 10202);
    			attr_dev(div29, "class", "column is-1 p-0");
    			add_location(div29, file$1, 303, 8, 11651);
    			if (!src_url_equal(img2.src, img2_src_value = "/imgs/fintech1.png")) attr_dev(img2, "src", img2_src_value);
    			set_style(img2, "max-width", "100%");
    			set_style(img2, "height", "auto");
    			set_style(img2, "width", "100%");
    			attr_dev(img2, "alt", "growth");
    			add_location(img2, file$1, 306, 16, 11792);
    			set_style(div30, "padding", "0rem");
    			add_location(div30, file$1, 305, 12, 11747);
    			attr_dev(div31, "class", "column is-4 has-text-centered");
    			add_location(div31, file$1, 304, 8, 11691);
    			attr_dev(div32, "class", "column is-6 center pl-5");
    			add_location(div32, file$1, 314, 8, 12004);
    			attr_dev(div33, "class", "column is-1 p-0");
    			add_location(div33, file$1, 366, 8, 14599);
    			attr_dev(div34, "class", "columns m-0 p-0 pt-5 pb-5");
    			attr_dev(div34, "style", "/*background-color:#00A2AD*/");
    			add_location(div34, file$1, 302, 4, 11566);
    			attr_dev(div35, "class", "column is-1 p-0");
    			add_location(div35, file$1, 370, 8, 14730);
    			attr_dev(div36, "class", "column is-5 center");
    			add_location(div36, file$1, 372, 8, 14771);
    			if (!src_url_equal(img3.src, img3_src_value = "/imgs/business-automation-wheel.png")) attr_dev(img3, "src", img3_src_value);
    			set_style(img3, "max-width", "100%");
    			set_style(img3, "height", "auto");
    			set_style(img3, "width", "100%");
    			attr_dev(img3, "alt", "growth");
    			add_location(img3, file$1, 390, 16, 15525);
    			attr_dev(div37, "style", "");
    			add_location(div37, file$1, 389, 12, 15494);
    			attr_dev(div38, "class", "column is-3 has-text-centered");
    			add_location(div38, file$1, 388, 8, 15438);
    			attr_dev(div39, "class", "column is-1 p-0");
    			add_location(div39, file$1, 397, 8, 15753);
    			attr_dev(div40, "class", "columns m-0 p-0 pt-5 pb-5");
    			set_style(div40, "background-color", "#ffbd5a");
    			add_location(div40, file$1, 369, 4, 14647);
    			attr_dev(div41, "class", "column is-1 p-0");
    			add_location(div41, file$1, 401, 8, 15886);
    			if (!src_url_equal(img4.src, img4_src_value = "/imgs/blockchain.png")) attr_dev(img4, "src", img4_src_value);
    			set_style(img4, "max-width", "100%");
    			set_style(img4, "height", "auto");
    			set_style(img4, "width", "100%");
    			attr_dev(img4, "alt", "growth");
    			add_location(img4, file$1, 404, 16, 16027);
    			set_style(div42, "padding", "0rem");
    			add_location(div42, file$1, 403, 12, 15982);
    			attr_dev(div43, "class", "column is-3 has-text-centered");
    			add_location(div43, file$1, 402, 8, 15926);
    			attr_dev(div44, "class", "column is-6 center pl-5");
    			add_location(div44, file$1, 412, 8, 16241);
    			attr_dev(div45, "class", "column is-1 p-0");
    			add_location(div45, file$1, 439, 8, 17610);
    			attr_dev(div46, "class", "columns m-0 p-0 pt-5 pb-5");
    			attr_dev(div46, "style", "/*background-color:#00A2AD*/");
    			add_location(div46, file$1, 400, 4, 15801);
    			attr_dev(div47, "class", "column is-1 p-0");
    			add_location(div47, file$1, 443, 8, 17706);
    			if (!src_url_equal(img5.src, img5_src_value = "/imgs/digital-marketing.png")) attr_dev(img5, "src", img5_src_value);
    			set_style(img5, "max-width", "100%");
    			set_style(img5, "height", "auto");
    			set_style(img5, "width", "100%");
    			attr_dev(img5, "alt", "growth");
    			add_location(img5, file$1, 449, 16, 17924);
    			set_style(div48, "padding", "1rem");
    			set_style(div48, "background-color", "#011566");
    			set_style(div48, "border-radius", "50rem");
    			add_location(div48, file$1, 446, 12, 17803);
    			attr_dev(div49, "class", "column is-3 has-text-centered");
    			add_location(div49, file$1, 445, 8, 17747);
    			attr_dev(div50, "class", "column is-5 center");
    			add_location(div50, file$1, 457, 8, 18145);
    			attr_dev(div51, "class", "column is-1 p-0");
    			add_location(div51, file$1, 473, 8, 18787);
    			attr_dev(div52, "class", "columns m-0 p-0 pt-5 pb-5");
    			add_location(div52, file$1, 442, 4, 17658);
    			add_location(br, file$1, 485, 49, 19208);
    			attr_dev(div53, "class", "has-text-centered is-size-4 txt-white p-3 pb-5 has-text-weight-bold");
    			set_style(div53, "font-family", "livvic");
    			add_location(div53, file$1, 481, 12, 19003);
    			attr_dev(div54, "class", "py-3 px-2 m-0");
    			set_style(div54, "background-color", "#010166");
    			set_style(div54, "padding-bottom", "7rem", 1);
    			add_location(div54, file$1, 477, 8, 18865);
    			attr_dev(div55, "class", "p-2");
    			add_location(div55, file$1, 501, 36, 19902);
    			attr_dev(div56, "class", "p-2");
    			add_location(div56, file$1, 502, 36, 19981);
    			attr_dev(div57, "class", "p-2");
    			add_location(div57, file$1, 505, 36, 20141);
    			attr_dev(div58, "class", "p-2");
    			add_location(div58, file$1, 506, 36, 20215);
    			add_location(div59, file$1, 500, 32, 19860);
    			attr_dev(div60, "class", "txt-white is-size-4 center");
    			set_style(div60, "width", "100%");
    			set_style(div60, "height", "100%");
    			add_location(div60, file$1, 496, 28, 19663);
    			attr_dev(div61, "class", "column p-3");
    			set_style(div61, "background-color", "#fe5970");
    			add_location(div61, file$1, 492, 24, 19496);
    			attr_dev(label0, "class", "label");
    			add_location(label0, file$1, 514, 40, 20605);
    			attr_dev(input0, "class", "input is-normal is-roundedr");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Your Name");
    			add_location(input0, file$1, 516, 44, 20745);
    			attr_dev(div62, "class", "control");
    			add_location(div62, file$1, 515, 40, 20679);
    			attr_dev(div63, "class", "field");
    			add_location(div63, file$1, 513, 36, 20545);
    			attr_dev(div64, "class", "column");
    			add_location(div64, file$1, 512, 32, 20488);
    			attr_dev(label1, "class", "label");
    			add_location(label1, file$1, 527, 40, 21361);
    			attr_dev(input1, "class", "input is-normal is-roundedr");
    			attr_dev(input1, "type", "tel");
    			attr_dev(input1, "placeholder", "Your Phone");
    			add_location(input1, file$1, 529, 44, 21502);
    			attr_dev(div65, "class", "control");
    			add_location(div65, file$1, 528, 40, 21436);
    			attr_dev(div66, "class", "field");
    			add_location(div66, file$1, 526, 36, 21301);
    			attr_dev(div67, "class", "column");
    			add_location(div67, file$1, 525, 32, 21244);
    			attr_dev(div68, "class", "columns");
    			add_location(div68, file$1, 511, 28, 20434);
    			attr_dev(label2, "class", "label");
    			add_location(label2, file$1, 542, 40, 22205);
    			attr_dev(input2, "class", "input is-normal is-roundedr");
    			attr_dev(input2, "type", "email");
    			attr_dev(input2, "placeholder", "Email");
    			add_location(input2, file$1, 544, 44, 22346);
    			attr_dev(div69, "class", "control");
    			add_location(div69, file$1, 543, 40, 22280);
    			attr_dev(div70, "class", "field");
    			add_location(div70, file$1, 541, 36, 22145);
    			attr_dev(div71, "class", "column");
    			add_location(div71, file$1, 540, 32, 22088);
    			attr_dev(label3, "class", "label");
    			add_location(label3, file$1, 555, 40, 22960);
    			attr_dev(input3, "class", "input is-normal is-roundedr");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "placeholder", "Subject");
    			add_location(input3, file$1, 557, 44, 23103);
    			attr_dev(div72, "class", "control");
    			add_location(div72, file$1, 556, 40, 23037);
    			attr_dev(div73, "class", "field");
    			add_location(div73, file$1, 554, 36, 22900);
    			attr_dev(div74, "class", "column");
    			add_location(div74, file$1, 553, 32, 22843);
    			attr_dev(div75, "class", "columns");
    			add_location(div75, file$1, 539, 28, 22034);
    			attr_dev(label4, "class", "label");
    			add_location(label4, file$1, 568, 32, 23686);
    			attr_dev(textarea, "class", "textarea");
    			attr_dev(textarea, "placeholder", "Message");
    			add_location(textarea, file$1, 570, 36, 23813);
    			attr_dev(div76, "class", "control");
    			add_location(div76, file$1, 569, 32, 23755);
    			attr_dev(div77, "class", "field");
    			add_location(div77, file$1, 567, 28, 23634);
    			attr_dev(button0, "class", "button is-danger is-normal is-roundedr");
    			add_location(button0, file$1, 579, 32, 24219);
    			attr_dev(div78, "class", "container has-text-centered");
    			add_location(div78, file$1, 578, 28, 24145);
    			attr_dev(div79, "class", "column px-6");
    			add_location(div79, file$1, 510, 24, 20379);
    			attr_dev(div80, "class", "columns");
    			add_location(div80, file$1, 491, 20, 19450);
    			attr_dev(div81, "class", "card-content p-0");
    			add_location(div81, file$1, 490, 16, 19399);
    			attr_dev(div82, "class", "card");
    			set_style(div82, "transform", "translateY(-7rem)");
    			add_location(div82, file$1, 489, 12, 19326);
    			attr_dev(div83, "class", "px-5 mx-5");
    			add_location(div83, file$1, 488, 8, 19289);
    			attr_dev(div84, "id", "contact-us");
    			add_location(div84, file$1, 476, 4, 18835);
    			attr_dev(div85, "class", "modal-background");
    			add_location(div85, file$1, 594, 8, 24784);
    			attr_dev(p, "class", "modal-card-title");
    			add_location(p, file$1, 597, 16, 24911);
    			attr_dev(header, "class", "modal-card-head");
    			add_location(header, file$1, 596, 12, 24862);
    			add_location(div86, file$1, 601, 16, 25042);
    			attr_dev(section, "class", "modal-card-body");
    			add_location(section, file$1, 600, 12, 24992);
    			attr_dev(button1, "class", "button is-success");
    			add_location(button1, file$1, 604, 16, 25153);
    			attr_dev(footer, "class", "modal-card-foot");
    			add_location(footer, file$1, 603, 12, 25104);
    			attr_dev(div87, "class", "modal-card");
    			add_location(div87, file$1, 595, 8, 24825);
    			attr_dev(button2, "class", "modal-close is-large");
    			attr_dev(button2, "aria-label", "close");
    			add_location(button2, file$1, 612, 8, 25389);
    			attr_dev(div88, "class", div88_class_value = "modal " + (/*show_modal*/ ctx[3] == true ? 'is-active' : ''));
    			add_location(div88, file$1, 593, 4, 24716);
    			set_style(div89, "width", "100vw");
    			add_location(div89, file$1, 141, 0, 5222);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div89, anchor);
    			append_dev(div89, div0);
    			mount_component(trade, div0, null);
    			append_dev(div89, t0);
    			append_dev(div89, div1);
    			mount_component(carousel0, div1, null);
    			append_dev(div89, t1);
    			append_dev(div89, div3);
    			append_dev(div3, div2);
    			append_dev(div3, t3);
    			mount_component(carousel1, div3, null);
    			append_dev(div89, t4);
    			append_dev(div89, div6);
    			append_dev(div6, div4);
    			append_dev(div4, span0);
    			append_dev(span0, t5);
    			/*div4_binding*/ ctx[16](div4);
    			append_dev(div6, t6);
    			append_dev(div6, div5);
    			append_dev(div5, span1);
    			append_dev(div89, t8);
    			append_dev(div89, div21);
    			append_dev(div21, div7);
    			append_dev(div21, t9);
    			append_dev(div21, div9);
    			append_dev(div9, div8);
    			append_dev(div8, img0);
    			append_dev(div21, t10);
    			append_dev(div21, div19);
    			append_dev(div19, div18);
    			append_dev(div18, div15);
    			append_dev(div15, div14);
    			append_dev(div14, span2);
    			append_dev(div14, t12);
    			append_dev(div14, span5);
    			append_dev(span5, span4);
    			append_dev(span4, span3);
    			append_dev(span3, div10);
    			append_dev(span3, t14);
    			append_dev(span3, div11);
    			append_dev(span3, t16);
    			append_dev(span3, div12);
    			append_dev(span3, t18);
    			append_dev(span3, div13);
    			append_dev(div18, t20);
    			append_dev(div18, div17);
    			append_dev(div17, div16);
    			append_dev(div21, t22);
    			append_dev(div21, div20);
    			append_dev(div89, t23);
    			append_dev(div89, div28);
    			append_dev(div28, div22);
    			append_dev(div28, t24);
    			append_dev(div28, div23);
    			if (if_block0) if_block0.m(div23, null);
    			append_dev(div28, t25);
    			append_dev(div28, div24);
    			append_dev(div28, t26);
    			append_dev(div28, div26);
    			append_dev(div26, div25);
    			append_dev(div25, img1);
    			append_dev(div28, t27);
    			append_dev(div28, div27);
    			append_dev(div89, t28);
    			append_dev(div89, div34);
    			append_dev(div34, div29);
    			append_dev(div34, t29);
    			append_dev(div34, div31);
    			append_dev(div31, div30);
    			append_dev(div30, img2);
    			append_dev(div34, t30);
    			append_dev(div34, div32);
    			if (if_block1) if_block1.m(div32, null);
    			append_dev(div34, t31);
    			append_dev(div34, div33);
    			append_dev(div89, t32);
    			append_dev(div89, div40);
    			append_dev(div40, div35);
    			append_dev(div40, t33);
    			append_dev(div40, div36);
    			if (if_block2) if_block2.m(div36, null);
    			append_dev(div40, t34);
    			append_dev(div40, div38);
    			append_dev(div38, div37);
    			append_dev(div37, img3);
    			append_dev(div40, t35);
    			append_dev(div40, div39);
    			append_dev(div89, t36);
    			append_dev(div89, div46);
    			append_dev(div46, div41);
    			append_dev(div46, t37);
    			append_dev(div46, div43);
    			append_dev(div43, div42);
    			append_dev(div42, img4);
    			append_dev(div46, t38);
    			append_dev(div46, div44);
    			if (if_block3) if_block3.m(div44, null);
    			append_dev(div46, t39);
    			append_dev(div46, div45);
    			append_dev(div89, t40);
    			append_dev(div89, div52);
    			append_dev(div52, div47);
    			append_dev(div52, t41);
    			append_dev(div52, div49);
    			append_dev(div49, div48);
    			append_dev(div48, img5);
    			append_dev(div52, t42);
    			append_dev(div52, div50);
    			if (if_block4) if_block4.m(div50, null);
    			append_dev(div52, t43);
    			append_dev(div52, div51);
    			append_dev(div89, t44);
    			append_dev(div89, div84);
    			append_dev(div84, div54);
    			append_dev(div54, div53);
    			append_dev(div53, t45);
    			append_dev(div53, br);
    			append_dev(div53, t46);
    			append_dev(div84, t47);
    			append_dev(div84, div83);
    			append_dev(div83, div82);
    			append_dev(div82, div81);
    			append_dev(div81, div80);
    			append_dev(div80, div61);
    			append_dev(div61, div60);
    			append_dev(div60, div59);
    			append_dev(div59, div55);
    			append_dev(div59, t49);
    			append_dev(div59, div56);
    			append_dev(div59, t51);
    			append_dev(div59, div57);
    			append_dev(div59, t53);
    			append_dev(div59, div58);
    			append_dev(div80, t55);
    			append_dev(div80, div79);
    			append_dev(div79, div68);
    			append_dev(div68, div64);
    			append_dev(div64, div63);
    			append_dev(div63, label0);
    			append_dev(div63, t57);
    			append_dev(div63, div62);
    			append_dev(div62, input0);
    			set_input_value(input0, /*name*/ ctx[8]);
    			append_dev(div68, t58);
    			append_dev(div68, div67);
    			append_dev(div67, div66);
    			append_dev(div66, label1);
    			append_dev(div66, t60);
    			append_dev(div66, div65);
    			append_dev(div65, input1);
    			set_input_value(input1, /*mobile*/ ctx[6]);
    			append_dev(div79, t61);
    			append_dev(div79, div75);
    			append_dev(div75, div71);
    			append_dev(div71, div70);
    			append_dev(div70, label2);
    			append_dev(div70, t63);
    			append_dev(div70, div69);
    			append_dev(div69, input2);
    			set_input_value(input2, /*email*/ ctx[7]);
    			append_dev(div75, t64);
    			append_dev(div75, div74);
    			append_dev(div74, div73);
    			append_dev(div73, label3);
    			append_dev(div73, t66);
    			append_dev(div73, div72);
    			append_dev(div72, input3);
    			set_input_value(input3, /*subject*/ ctx[9]);
    			append_dev(div79, t67);
    			append_dev(div79, div77);
    			append_dev(div77, label4);
    			append_dev(div77, t69);
    			append_dev(div77, div76);
    			append_dev(div76, textarea);
    			set_input_value(textarea, /*message*/ ctx[10]);
    			append_dev(div79, t70);
    			append_dev(div79, div78);
    			append_dev(div78, button0);
    			append_dev(div89, t72);
    			append_dev(div89, div88);
    			append_dev(div88, div85);
    			append_dev(div88, t73);
    			append_dev(div88, div87);
    			append_dev(div87, header);
    			append_dev(header, p);
    			append_dev(p, t74);
    			append_dev(div87, t75);
    			append_dev(div87, section);
    			append_dev(section, div86);
    			append_dev(div86, t76);
    			append_dev(div87, t77);
    			append_dev(div87, footer);
    			append_dev(footer, button1);
    			append_dev(div88, t79);
    			append_dev(div88, button2);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "scroll", /*scroll_handler*/ ctx[15], false, false, false),
    					action_destroyer(inview.call(null, div6)),
    					listen_dev(div6, "change", handleChange, false, false, false),
    					action_destroyer(reveal.call(null, div18)),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[17]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[18]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[19]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[20]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[21]),
    					listen_dev(button0, "click", /*click_handler*/ ctx[22], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[23], false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[24], false, false, false),
    					listen_dev(div89, "wheel", /*wheel_handler*/ ctx[25], false, false, false),
    					listen_dev(div89, "scroll", /*scroll_handler_1*/ ctx[26], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const carousel1_changes = {};

    			if (dirty[1] & /*$$scope*/ 8) {
    				carousel1_changes.$$scope = { dirty, ctx };
    			}

    			carousel1.$set(carousel1_changes);

    			if (!current || dirty[0] & /*big_text_size*/ 4) {
    				set_style(span0, "font-size", /*big_text_size*/ ctx[2] == null
    				? "2.5rem"
    				: /*big_text_size*/ ctx[2]);
    			}

    			if (/*show_reveal*/ ctx[0]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div23, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*show_reveal*/ ctx[0]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div32, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*show_reveal*/ ctx[0]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(div36, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*show_reveal*/ ctx[0]) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(div44, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*show_reveal*/ ctx[0]) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block(ctx);
    					if_block4.c();
    					if_block4.m(div50, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (dirty[0] & /*name*/ 256 && input0.value !== /*name*/ ctx[8]) {
    				set_input_value(input0, /*name*/ ctx[8]);
    			}

    			if (dirty[0] & /*mobile*/ 64) {
    				set_input_value(input1, /*mobile*/ ctx[6]);
    			}

    			if (dirty[0] & /*email*/ 128 && input2.value !== /*email*/ ctx[7]) {
    				set_input_value(input2, /*email*/ ctx[7]);
    			}

    			if (dirty[0] & /*subject*/ 512 && input3.value !== /*subject*/ ctx[9]) {
    				set_input_value(input3, /*subject*/ ctx[9]);
    			}

    			if (dirty[0] & /*message*/ 1024) {
    				set_input_value(textarea, /*message*/ ctx[10]);
    			}

    			if (!current || dirty[0] & /*modal_title*/ 32) set_data_dev(t74, /*modal_title*/ ctx[5]);
    			if (!current || dirty[0] & /*modal_message*/ 16) set_data_dev(t76, /*modal_message*/ ctx[4]);

    			if (!current || dirty[0] & /*show_modal*/ 8 && div88_class_value !== (div88_class_value = "modal " + (/*show_modal*/ ctx[3] == true ? 'is-active' : ''))) {
    				attr_dev(div88, "class", div88_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(trade.$$.fragment, local);
    			transition_in(carousel0.$$.fragment, local);
    			transition_in(carousel1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(trade.$$.fragment, local);
    			transition_out(carousel0.$$.fragment, local);
    			transition_out(carousel1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div89);
    			destroy_component(trade);
    			destroy_component(carousel0);
    			destroy_component(carousel1);
    			/*div4_binding*/ ctx[16](null);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleChange(e) {
    	console.log(e.detail);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Desktop', slots, []);

    	const scroll_event = e => {
    		onwheel(e.target);
    	};

    	//console.log(scroll_event) 
    	let show_reveal = false;

    	let go_big_ele;
    	let big_text_size = null;

    	afterUpdate(() => {
    		$$invalidate(0, show_reveal = true);
    	});

    	var slides = [
    		"https://storage.googleapis.com/zovibecdnin/images/gr/main_carousel1-3-01_01.jpg",
    		"https://storage.googleapis.com/zovibecdnin/images/gr/main_carousel1-3-01_03.jpg"
    	];

    	var slides1 = [
    		["/imgs/web-design.png", "Web Development"],
    		["/imgs/development.png", "Mobile Development"],
    		["/imgs/social-media.png", "Digital Marketing"],
    		["/imgs/automation.png", "Business Automation"],
    		["/imgs/artificial-intelligence.png", "Artifical intelligence"],
    		["/imgs/internet-of-things.png", "Internet of Things"],
    		["/imgs/erp.png", "Enterprise Resources"],
    		["/imgs/solutions.png", "Custom Solutions"],
    		["/imgs/big-data.png", "BigData Technology"]
    	];

    	let show_modal = false;
    	let modal_message = "Thanks for contacing Wesics. Your Message has been sent successfully! We'll get back on your query soon";
    	let modal_title = "Success";
    	let mobile;
    	let email;
    	let name;
    	let subject;
    	let message;

    	const validateEmail = email => {
    		return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    	};

    	async function send_message() {
    		console.log("Sending request");

    		// Calls the external refresh token create endpoint
    		var params = new URLSearchParams();

    		if (email == null || !validateEmail(email)) {
    			$$invalidate(5, modal_title = "Error");
    			$$invalidate(4, modal_message = "Invalid email. Kindly check email and try again");
    			$$invalidate(3, show_modal = true);
    		} else if (subject == null || subject.length < 2) {
    			$$invalidate(5, modal_title = "Error");
    			$$invalidate(4, modal_message = "Subject empty. Kindly enter subject (Minimum 3 characters) and try again");
    			$$invalidate(3, show_modal = true);
    		} else if (message == null || message.length < 5) {
    			$$invalidate(5, modal_title = "Error");
    			$$invalidate(4, modal_message = "Message empty. Kindly enter Message (Minimum 5 characters) and try again");
    			$$invalidate(3, show_modal = true);
    		} else if (name == null || name.length < 3) {
    			$$invalidate(5, modal_title = "Error");
    			$$invalidate(4, modal_message = "Name empty. Kindly enter name (Minimum 3 characters) and try again");
    			$$invalidate(3, show_modal = true);
    		} else {
    			params.append("name", name);
    			params.append("email", email);
    			params.append("mobile", mobile);
    			params.append("subject", subject);
    			params.append("message", message);
    			console.log(params);
    			const response = await fetch_json("https://api.in.zovibe.com/api/wesics/query", params);

    			if (response.status == "success") {
    				console.log(response);
    				$$invalidate(5, modal_title = "Success");
    				$$invalidate(3, show_modal = true);
    			} else {
    				$$invalidate(5, modal_title = "Error");
    				$$invalidate(4, modal_message = "Some Error! Please try again");

    				if (response.message != null && response.message.length > 4) {
    					$$invalidate(4, modal_message = response.message);
    				}

    				$$invalidate(3, show_modal = true);
    			}
    		}
    	}

    	function onwheel(e) {
    		let pos = go_big_ele.getBoundingClientRect();

    		if (pos != null) {
    			if (window_height == null) {
    				window_height = window.innerHeight;
    				window_width = window.innerWidth;
    			}

    			let full_text_size = Math.ceil(window_width / 6.5);
    			let current_top_perc = (pos.y + pos.height / 1.8) / window_height * 100;

    			if (current_top_perc > 30 && current_top_perc < 101) {
    				let new_text_size = Math.ceil(full_text_size / 2.5 + full_text_size * ((100 - current_top_perc) / 100));

    				if (new_text_size > full_text_size) {
    					new_text_size = full_text_size;
    				}

    				$$invalidate(2, big_text_size = new_text_size + "px");
    			} else if (current_top_perc < 30) {
    				$$invalidate(2, big_text_size = full_text_size + "px");
    			}
    		}
    	} //console.log(e,"go_big_ele",pos.y,pos.top,pos.height,window.innerHeight)

    	let window_height;
    	let window_width;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Desktop> was created with unknown prop '${key}'`);
    	});

    	const scroll_handler = e => {
    		console.log(e);
    	};

    	function div4_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			go_big_ele = $$value;
    			$$invalidate(1, go_big_ele);
    		});
    	}

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(8, name);
    	}

    	function input1_input_handler() {
    		mobile = this.value;
    		$$invalidate(6, mobile);
    	}

    	function input2_input_handler() {
    		email = this.value;
    		$$invalidate(7, email);
    	}

    	function input3_input_handler() {
    		subject = this.value;
    		$$invalidate(9, subject);
    	}

    	function textarea_input_handler() {
    		message = this.value;
    		$$invalidate(10, message);
    	}

    	const click_handler = () => {
    		send_message();
    	};

    	const click_handler_1 = () => {
    		$$invalidate(3, show_modal = false);
    	};

    	const click_handler_2 = () => {
    		$$invalidate(3, show_modal = false);
    	};

    	const wheel_handler = e => {
    		onwheel();
    	};

    	const scroll_handler_1 = e => {
    		console.log(e);
    	};

    	$$self.$capture_state = () => ({
    		fetch_json,
    		reveal,
    		afterUpdate,
    		inview,
    		Trade,
    		scroll_event,
    		show_reveal,
    		go_big_ele,
    		big_text_size,
    		slides,
    		slides1,
    		Carousel,
    		CAROUSEL: Carousel_1,
    		show_modal,
    		modal_message,
    		modal_title,
    		mobile,
    		email,
    		name,
    		subject,
    		message,
    		validateEmail,
    		send_message,
    		handleChange,
    		onwheel,
    		window_height,
    		window_width
    	});

    	$$self.$inject_state = $$props => {
    		if ('show_reveal' in $$props) $$invalidate(0, show_reveal = $$props.show_reveal);
    		if ('go_big_ele' in $$props) $$invalidate(1, go_big_ele = $$props.go_big_ele);
    		if ('big_text_size' in $$props) $$invalidate(2, big_text_size = $$props.big_text_size);
    		if ('slides' in $$props) slides = $$props.slides;
    		if ('slides1' in $$props) $$invalidate(11, slides1 = $$props.slides1);
    		if ('show_modal' in $$props) $$invalidate(3, show_modal = $$props.show_modal);
    		if ('modal_message' in $$props) $$invalidate(4, modal_message = $$props.modal_message);
    		if ('modal_title' in $$props) $$invalidate(5, modal_title = $$props.modal_title);
    		if ('mobile' in $$props) $$invalidate(6, mobile = $$props.mobile);
    		if ('email' in $$props) $$invalidate(7, email = $$props.email);
    		if ('name' in $$props) $$invalidate(8, name = $$props.name);
    		if ('subject' in $$props) $$invalidate(9, subject = $$props.subject);
    		if ('message' in $$props) $$invalidate(10, message = $$props.message);
    		if ('window_height' in $$props) window_height = $$props.window_height;
    		if ('window_width' in $$props) window_width = $$props.window_width;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		show_reveal,
    		go_big_ele,
    		big_text_size,
    		show_modal,
    		modal_message,
    		modal_title,
    		mobile,
    		email,
    		name,
    		subject,
    		message,
    		slides1,
    		send_message,
    		onwheel,
    		scroll_event,
    		scroll_handler,
    		div4_binding,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		textarea_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		wheel_handler,
    		scroll_handler_1
    	];
    }

    class Desktop extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$1, create_fragment$1, safe_not_equal$1, { scroll_event: 14 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Desktop",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get scroll_event() {
    		return this.$$.ctx[14];
    	}

    	set scroll_event(value) {
    		throw new Error("<Desktop>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.46.4 */

    const { document: document_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let link0;
    	let link1;
    	let link2;
    	let link3;
    	let link4;
    	let link5;
    	let t0;
    	let main;
    	let nav;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
    	let t1;
    	let a1;
    	let span;
    	let t3;
    	let div1;
    	let home;
    	let t4;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	let home_props = {};
    	home = new Desktop({ props: home_props, $$inline: true });
    	/*home_binding*/ ctx[1](home);
    	footer = new Desktop$1({ $$inline: true });

    	const block = {
    		c: function create() {
    			link0 = element("link");
    			link1 = element("link");
    			link2 = element("link");
    			link3 = element("link");
    			link4 = element("link");
    			link5 = element("link");
    			t0 = space();
    			main = element("main");
    			nav = element("nav");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t1 = space();
    			a1 = element("a");
    			span = element("span");
    			span.textContent = "WESICS";
    			t3 = space();
    			div1 = element("div");
    			create_component(home.$$.fragment);
    			t4 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(link0, "rel", "stylesheet");
    			attr_dev(link0, "href", "https://fonts.googleapis.com/icon?family=Material+Icons");
    			attr_dev(link0, "class", "svelte-ce6kae");
    			add_location(link0, file, 58, 1, 1355);
    			attr_dev(link1, "rel", "stylesheet");
    			attr_dev(link1, "href", "https://fonts.googleapis.com/css?family=Roboto:300,400,500,600,700");
    			attr_dev(link1, "class", "svelte-ce6kae");
    			add_location(link1, file, 63, 1, 1467);
    			attr_dev(link2, "rel", "stylesheet");
    			attr_dev(link2, "href", "https://fonts.googleapis.com/css?family=Roboto+Mono");
    			attr_dev(link2, "class", "svelte-ce6kae");
    			add_location(link2, file, 68, 1, 1595);
    			attr_dev(link3, "rel", "stylesheet");
    			attr_dev(link3, "href", "https://fonts.googleapis.com/css?family=Livvic");
    			attr_dev(link3, "class", "svelte-ce6kae");
    			add_location(link3, file, 73, 4, 1690);
    			attr_dev(link4, "href", "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600&display=swap");
    			attr_dev(link4, "rel", "stylesheet");
    			attr_dev(link4, "class", "svelte-ce6kae");
    			add_location(link4, file, 75, 4, 1782);
    			attr_dev(link5, "rel", "stylesheet");
    			attr_dev(link5, "href", "https://cdn.jsdelivr.net/npm/bulma@0.9.3/css/bulma.min.css");
    			attr_dev(link5, "class", "svelte-ce6kae");
    			add_location(link5, file, 78, 1, 1943);
    			set_style(img, "max-height", "100px", 1);
    			if (!src_url_equal(img.src, img_src_value = "/imgs/wesics-logo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "40");
    			attr_dev(img, "height", "40");
    			attr_dev(img, "class", "svelte-ce6kae");
    			add_location(img, file, 96, 4, 2716);
    			attr_dev(a0, "class", "navbar-item p-0 pl-5 svelte-ce6kae");
    			attr_dev(a0, "href", "https://wesics.com");
    			add_location(a0, file, 95, 3, 2653);
    			attr_dev(span, "class", "animate-charcter has-text-weight-bold svelte-ce6kae");
    			add_location(span, file, 104, 4, 2920);
    			attr_dev(a1, "class", "navbar-item txt-white is-size-5 roboto-mono animate-text svelte-ce6kae");
    			add_location(a1, file, 102, 3, 2842);
    			attr_dev(div0, "class", "navbar-brand svelte-ce6kae");
    			add_location(div0, file, 94, 2, 2623);
    			attr_dev(nav, "class", "navbar is-fixed-top animated-box in svelte-ce6kae");
    			attr_dev(nav, "style", "background-color:#010166;background: linear-gradient(to bottom right, #45108a , #32065b , #12054e ); background: url(/imgs/1060-ai.svg); background-repeat: no-repeat; background-size: cover; position: fixed; width: 90%; left: 5%; top: 14px; /*box-shadow: 0 4px 10px rgb(0 0 0 / 45%);*/ border-radius: 0.5rem; /*box-shadow: 5px 5px 10px #00bc9e, -5px -5px 10px #00e6c2;*/");
    			attr_dev(nav, "role", "navigation");
    			attr_dev(nav, "aria-label", "main navigation");
    			add_location(nav, file, 88, 1, 2139);
    			set_style(div1, "width", "100%");
    			set_style(div1, "padding-top", "52px");
    			attr_dev(div1, "class", "svelte-ce6kae");
    			add_location(div1, file, 110, 1, 3013);
    			attr_dev(main, "class", "svelte-ce6kae");
    			add_location(main, file, 84, 0, 2056);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document_1.head, link0);
    			append_dev(document_1.head, link1);
    			append_dev(document_1.head, link2);
    			append_dev(document_1.head, link3);
    			append_dev(document_1.head, link4);
    			append_dev(document_1.head, link5);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, nav);
    			append_dev(nav, div0);
    			append_dev(div0, a0);
    			append_dev(a0, img);
    			append_dev(div0, t1);
    			append_dev(div0, a1);
    			append_dev(a1, span);
    			append_dev(main, t3);
    			append_dev(main, div1);
    			mount_component(home, div1, null);
    			append_dev(div1, t4);
    			mount_component(footer, div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(main, "scroll", /*scroll_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const home_changes = {};
    			home.$set(home_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(link0);
    			detach_dev(link1);
    			detach_dev(link2);
    			detach_dev(link3);
    			detach_dev(link4);
    			detach_dev(link5);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			/*home_binding*/ ctx[1](null);
    			destroy_component(home);
    			destroy_component(footer);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();

    	(function () {
    		var s1 = document.createElement("script"),
    			s0 = document.getElementsByTagName("script")[0];

    		s1.async = true;
    		s1.src = 'https://embed.tawk.to/62224715a34c2456412979a0/1ftaubblr';
    		s1.charset = 'UTF-8';
    		s1.setAttribute('crossorigin', '*');
    		s0.parentNode.insertBefore(s1, s0);
    	})();

    	let scroll_event;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function home_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			scroll_event = $$value;
    			$$invalidate(0, scroll_event);
    		});
    	}

    	const scroll_handler = e => {
    		scroll_event.scroll_event(e);
    	}; //scroll_event = e;

    	$$self.$capture_state = () => ({
    		Footer: Desktop$1,
    		Home: Desktop,
    		Tawk_API,
    		Tawk_LoadStart,
    		scroll_event
    	});

    	$$self.$inject_state = $$props => {
    		if ('Tawk_API' in $$props) Tawk_API = $$props.Tawk_API;
    		if ('Tawk_LoadStart' in $$props) Tawk_LoadStart = $$props.Tawk_LoadStart;
    		if ('scroll_event' in $$props) $$invalidate(0, scroll_event = $$props.scroll_event);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [scroll_event, home_binding, scroll_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance, create_fragment, safe_not_equal$1, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
