var VueRender = (function(exports) {
  // console.log(1233,Vue)
  const { effect, ref, reactive, shallowReactive, shallowReadonly } = Vue;
  /**
       *
       * dom.setAttribute('id','app')  dom.id = app
       * HTML Attribute 和 DOM properties 区别
       * 并不是所有HTML Attribute d都有与之映射的DOM properties
       * 例 input 的value  input.getAttribute('value') 初始值  input.value 更新后的值
       * 优先设置DOM properties 当值为空字符串，设为true
       *
       * 微任务会穿插在由事件冒泡触发的多个事件处理函数之间被执行
       * 值发生在多children的情况才diff diff算法通过减少dom操作来优化更新性能
       */

      // function renderer(dom,container){
      //   container.innerHTML = dom
      // }

      // let count = ref(1)

      // effect(() => {
      //   renderer(`<h1>${count.value}</h1>`,document.getElementById('app'))
      // })
      // setTimeout(() => {
      //   count.value = 666
      // },2000)
      // 所有表单袁术的form属性都应该通过HTML Attribute设置

      // 将class 的不同表现形式序列化为字符串 class: 'a b c'

      const isArray = Array.isArray;
      const isFunction = (val) => typeof val === "function";
      const isString = (val) => typeof val === "string";
      const isSymbol = (val) => typeof val === "symbol";
      const isObject = (val) => val !== null && typeof val === "object";
      const Comment = Symbol(); //注释节点的type
      const Text = Symbol(); //文本节点的type
      const Fragment = Symbol();
      const isPromise = (val) => {
        return (
          (isObject(val) || isFunction(val)) &&
          isFunction(val.then) &&
          isFunction(val.catch)
        );
      };

      const listDelimiterRE = /;(?![^(]*\))/g;
      const propertyDelimiterRE = /:([^]+)/;
      const styleCommentRE = /\/\*[^]*?\*\//g;
      // 任务缓存队列
      const queue = new Set();
      let isFlushing = false;
      let p = Promise.resolve();
      // 存储当前正在被初始化的实例
      let currentInstance = null;

      function setCurrentInstance(instance) {
        currentInstance = instance;
      }
      // 批量更新
      function flushJob(job) {
        queue.add(job);
        if (isFlushing) return;
        isFlushing = true;
        p.then(() => {
          queue.forEach((job) => job());
        }).finally(() => {
          // 重置状态
          isFlushing = false;
          queue.length = 0;
        });
      }

      // 针对不同形式传递的style 和class 序列化操作  class: 'a b c'   style: {color:'red'}
      function parseStringStyle(cssText) {
        const ret = {};
        cssText
          .replace(styleCommentRE, "")
          .split(listDelimiterRE)
          .forEach((item) => {
            if (item) {
              const tmp = item.split(propertyDelimiterRE);
              tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
            }
          });
        return ret;
      }

      function normalizeStyle(value) {
        if (isArray(value)) {
          const res = {};
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            const normalized = isString(item)
              ? parseStringStyle(item)
              : normalizeStyle(item);
            if (normalized) {
              for (const key in normalized) {
                res[key] = normalized[key];
              }
            }
          }
          return res;
        } else if (isString(value) || isObject(value)) {
          return value;
        }
      }

      function normalizeProps(props) {
        if (!props) return null;
        let { class: klass, style } = props;
        if (klass && !isString(klass)) {
          props.class = normalizeClass(klass);
        }
        if (style) {
          props.style = normalizeStyle(style);
        }
        return props;
      }
      function normalizeClass(value) {
        let res = "";
        if (typeof value === "string") {
          res = value;
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const normalized = normalizeClass(value[i]);
            if (normalized) {
              res += normalized + " ";
            }
          }
        } else if (typeof value === "object" && value !== null) {
          for (const name in value) {
            if (value[name]) {
              res += name + " ";
            }
          }
        }
        return res.trim();
      }

      function unmount(vnode) {
        if (vnode.type === Fragment) {
          vnode.children.forEach((c) => unmount(c));
          return;
        }
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
      }

      function shouldSetAsProps(el, key, value) {
        if (key === "form" && el.tagName === "INPUT") return false;
        return key in el;
      }

      function onMounted(fn) {
        if (currentInstance) {
          // 将生命周期添加到当前实例的mounted[]
          currentInstance.mounted.push(fn);
        } else {
          console.error("onMounted只能在setup中调用");
        }
      }

      function createRenderer(options) {
        const {
          createElement,
          setElementText,
          insert,
          patchProps,
          setText,
          createText,
        } = options;

        // 双端diff算法
        // 1 四个方向比对
        // 2.取newStartVNode在oldChildren中查找可复用节点 存在移动位置 不存在将newStartVnode节点挂载到oldStartVNode之前
        // 3.比对结束查看剩余节点 检查索引值情况 有遗留新节点 顺序挂载遗留节点  移除未匹配的旧节点
        function patchKeyedChildren(n1, n2, container) {
          const oldChildren = n1.children;
          const newChildren = n2.children;
          let oldStartIdx = 0;
          let oldEndIdx = oldChildren.length - 1;
          let newStartIdx = 0;
          let newEndIdx = newChildren.length - 1;
          // 四个索引指向的vnode
          let oldStartVNode = oldChildren[oldStartIdx];
          let oldEndVNode = oldChildren[oldEndIdx];
          let newStartVNode = newChildren[newStartIdx];
          let newEndVNode = newChildren[newEndIdx];
          //
          while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (!oldStartVNode) {
              oldStartVNode = oldChildren[++oldStartIdx];
            } else if (!oldEndVNode) {
              oldEndVNode = newChildren[--oldEndIdx];
            } else if (oldStartVNode?.key === newStartVNode?.key) {
              patch(oldStartVNode, newStartVNode, container);
              oldStartVNode = oldChildren[++oldStartIdx];
              newStartVNode = newChildren[++newStartIdx];
            } else if (oldEndVNode?.key === newEndVNode?.key) {
              patch(oldEndVNode, newEndVNode, container);
              oldEndVNode = oldChildren[--oldEndIdx];
              newEndVNode = newChildren[--newEndIdx];
            } else if (oldStartVNode?.key === newEndVNode?.key) {
              patch(oldStartVNode, newEndVNode, container);
              insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
              oldStartVNode = oldChildren[++oldStartIdx];
              newEndVNode = newChildren[--newEndIdx];
            } else if (oldEndVNode?.key === newStartVNode?.key) {
              patch(oldEndVNode, newStartVNode, container);
              // 移动到oldStartVNode前面
              insert(oldEndVNode.el, container, oldStartVNode.el);
              // 更新索引指向前一个位置
              oldEndVNode = oldChildren[--oldEndIdx];
              // 指向下一个
              newStartVNode = newChildren[++newStartIdx];
            } else {
              console.log(newStartVNode);
              // 以上都不满足，使用newStartVNode去oldChildren中查找
              const idxInOld = oldChildren.findIndex(
                (node) => node && node.key === newStartVNode?.key
              );
              // 旧节点中存在newStartVnode
              if (idxInOld > 0) {
                const vnodeToMove = oldChildren[idxInOld];

                patch(vnodeToMove, newStartVNode, container);
                insert(vnodeToMove.el, container, oldStartVNode.el);
                // // 此时idxInOld 对应的真实dom已移动 将其设为undefined
                oldChildren[idxInOld] = undefined;
              } else {
                // 旧节点中不存在newStartVnode 将newStartVnode节点挂载到oldStartVNode之前
                patch(null, newStartVNode, container, oldStartVNode.el);
              }
              // 移动newStartIdx到下一个位置
              newStartVNode = newChildren[++newStartIdx];
            }
          }

          // 循环结束后检查索引值情况 满足条件有遗留节点 顺序挂载遗留节点
          if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
            for (let i = newStartIdx; i <= newEndIdx; i++) {
              patch(null, newChildren[i], container, oldStartVNode.el);
              // insert(newChildren[i], container, oldStartVNode.el)
            }
            // 移除未匹配的旧节点
          } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
            for (let i = oldStartIdx; i <= oldEndIdx; i++) {
              unmount(oldChildren[i]);
            }
          }
        }

        // 最长递增子序列
        // function patchKeyedChildren(n1, n2, container) {
        //   const oldChildren = n1.children;
        //   const newChildren = n2.children;
        //   let j = 0; //指向新旧节点的开头
        //   let oldVnode = oldChildren[j];
        //   let newVnode = newChildren[j];
        //   // 更新向通的前置节点
        //   // 循环向后遍历直到遇到拥有不同key为止
        //   while (oldVnode.key === newVnode.key) {
        //     patch(oldVnode, newVnode, container);
        //     // 更新索引 递增
        //     j++;
        //     oldVnode = oldChildren[j];
        //     newVnode = newChildren[j];
        //   }

        //   // 更新相同的后置节点
        //   let oldEnd = oldChildren.length - 1;
        //   let newEnd = newChildren.length - 1;

        //   oldVnode = oldChildren[oldEnd];
        //   newVnode = newChildren[newEnd];
        //   // 更新相同的后置节点
        //   while (oldVnode.key === newVnode.key) {
        //     patch(oldVnode, newVnode, container);
        //     // 更新索引 递增
        //     oldEnd--;
        //     newEnd--;
        //     oldVnode = oldChildren[oldEnd];
        //     newVnode = newChildren[newEnd];
        //   }

        //   // 满足条件从j---> newEnd 之间的节点应作为新节点插入
        //   if (j > oldEnd && j <= newEnd) {
        //     // 插入的锚点索引
        //     const anchorIndex = newEnd + 1;
        //     // 锚点元素
        //     const anchor =
        //       anchorIndex < newChildren.length
        //         ? newChildren[anchorIndex].el
        //         : null;
        //     // 顺序挂载新节点
        //     while (j <= newEnd) {
        //       patch(null, newChildren[j++], container, anchor);
        //     }
        //   } else if (j > newEnd && j <= oldEnd) {
        //     // 卸载多余旧节点
        //     while (j <= oldEnd) {
        //       unmount(oldChildren[j++]);
        //     }
        //   } else {
        //     // 处理复杂情况
        //     // 最长递增子序列
        //     // 新节点中剩余未处理节点数量
        //     const count = newEnd - j + 1;
        //     // 存储新节点在旧节点中的位置索引 计算最长递增子序列
        //     const source = new Array(count);
        //     source.fill(-1);
        //     // 初始检索位置
        //     const oldStart = j;
        //     const newStart = j;
        //     // 构建索引表 降低时间复杂度
        //     let keyIndex = {};

        //     // 判断节点是否需要移动
        //     let moved = false;
        //     // 记录遍历旧节点中遇到的最大索引值 索引为递增趋势 不需要移动节点
        //     let pos = 0;
        //     // 代表更新过的节点数量
        //     let patched = 0;
        //     for (let i = newStart; i <= newEnd; i++) {
        //       keyIndex[newChildren[i].key] = i;
        //     }
        //     // debugger;
        //     // 遍历旧节点
        //     // for (let i = oldStart; i <= oldEnd; i++) {
        //     //   const oldVnode = oldChildren[i];
        //     //   for (let k = newStart; k <= newEnd; k++) {
        //     //     const newVnode = newChildren[k];
        //     //     debugger;
        //     //     // 找到相同key节点 可复用
        //     //     if (oldVnode.key === newVnode.key) {
        //     //       patch(oldVnode, newVnode, container);
        //     //       // 填充source数组
        //     //       source[k - newStart] = i;
        //     //     }
        //     //   }
        //     // }

        //     for (let i = oldStart; i <= oldEnd; i++) {
        //       const oldVnode = oldChildren[i];
        //       // 如果更新过的节点数量小于等于需要更新的节点数量，执行更新
        //       if (patched <= count) {
        //         const k = keyIndex[oldVnode.key];

        //         if (typeof k !== "undefined") {
        //           newVnode = newChildren[k];
        //           patch(oldVnode, newVnode, container);
        //           // 每更新一个节点加一
        //           patched++;
        //           source[k - newStart] = i;
        //           // 判断节点是否需要移动
        //           if (k < pos) {
        //             moved = true;
        //           } else {
        //             pos = k;
        //           }
        //         } else {
        //           // 没找到卸载
        //           unmount(oldVnode);
        //         }
        //       } else {
        //         // 如果更新过的节点数量大于需要更新的节点数量，卸载多余节点
        //         unmount(oldVnode);
        //       }
        //     }
        //     // 需要
        //     if (moved) {
        //       // 计算最长递增子序列
        //       const seq = longestIncreasingSubsequence(source);
        //       // 指向最长递增子序列的最后一个元素
        //       let s = seq.length - 1;
        //       // 指向新的一组子节点的最后一个元素
        //       let i = count - 1;
        //       for (i; i >= 0; i--) {
        //         if (source[i] === -1) {
        //           const pos = i + newStart;
        //           const newVnode = newChildren[pos];
        //           const nextPos = pos + 1;
        //           const anchor =
        //             nextPos < newChildren.length ? newChildren[nextPos].el : null;
        //           patch(null, newVnode, container, anchor);
        //         } else if (i !== seq[j]) {
        //           const pos = i + newStart;
        //           const newVnode = newChildren[pos];
        //           const nextPos = pos + 1;
        //           const anchor =
        //             nextPos < newChildren.length ? newChildren[nextPos].el : null;
        //           insert(newVnode.el, container, anchor);
        //         } else {
        //           s--;
        //         }
        //       }
        //       // debugger;
        //     }
        //   }
        // }

        function longestIncreasingSubsequence(nums) {
          if (nums.length === 0) return [];

          const dp = new Array(nums.length).fill(1); // dp[i] 表示以 nums[i] 结尾的最长递增子序列的长度
          const prev = new Array(nums.length).fill(-1); // prev[i] 用于回溯最长递增子序列的前驱索引

          let maxLength = 1; // 最长递增子序列的长度
          let maxIndex = 0; // 最长递增子序列的结束索引

          for (let i = 1; i < nums.length; i++) {
            for (let j = 0; j < i; j++) {
              if (nums[i] > nums[j] && dp[i] < dp[j] + 1) {
                dp[i] = dp[j] + 1;
                prev[i] = j;
              }
            }
            // 更新最长递增子序列的长度和结束索引
            if (dp[i] > maxLength) {
              maxLength = dp[i];
              maxIndex = i;
            }
          }

          // 回溯得到最长递增子序列的索引
          const indices = [];
          while (maxIndex >= 0) {
            indices.push(maxIndex);
            maxIndex = prev[maxIndex];
          }

          return indices.reverse(); // 反转序列，因为回溯得到的顺序是反向的
        }
        // diff对比新旧子节点
        function patchChildren(n1, n2, container) {
          // 新children 为文本
          if (typeof n2.children === "string") {
            if (isArray(n1.children)) {
              n1.children.forEach((c) => unmount(c));
            }

            setElementText(container, n2.children);
            // 新children拥有多个子节点
          } else if (isArray(n2.children)) {
            if (isArray(n1.children)) {
              patchKeyedChildren(n1, n2, container);
            } else {
              setElementText(container, "");
              n2.children.forEach((c) => patch(null, c, container));
            }
          } else {
            // 新子节点不存在 旧的有
            if (isArray(n1.children)) {
              n1.children.forEach((c) => unmount(c));
            } else if (typeof n1.children === "string") {
              // 旧子节点为文本清空
              setElementText(container, "");
            }

            // n2.children.forEach(c => patch(null,c,container))
          }
        }
        function patchElement(n1, n2) {
          // 子节点三种情况 没有子节点 文本子节点 多子节点（文本或多元素等）
          const el = (n2.el = n1.el);
          const oldProps = n1.props;
          const newProps = n2.props;
          // 更新props
          for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
              patchProps(el, key, oldProps[key], newProps[key]);
            }
          }
          for (const key in oldProps) {
            if (!(key in newProps)) {
              patchProps(el, key, oldProps[key], null);
            }
          }
          // 更新children
          patchChildren(n1, n2, el);
        }

        function mountElement(vnode, container, anchor) {
          // let el = document.createElement(vnode.type)
          // 让vnode与真实dom产生联系
          let el = (vnode.el = createElement(vnode.type));
          // 有属性添加属性   Attribute 和 DOM properties 区别
          if (vnode.props) {
            for (let key in vnode.props) {
              const value = vnode.props[key];
              // 解决 HTML Attribute 和 DOM properties 差异
              patchProps(el, key, null, vnode.props[key]);
              // el[key] = vnode.props[key]
            }
          }
          // 子元素为字符串
          if (typeof vnode.children === "string") {
            // el.textContent = vnode.children
            setElementText(el, vnode.children);
          }
          // 子元素为数组
          if (Array.isArray(vnode.children)) {
            // el.textContent = vnode.children
            vnode.children.forEach((child) => {
              patch(null, child, el);
            });
          }
          // container.appendChild(el)
          insert(el, container, anchor);
        }
        function resolveProps(propsData, propOptions) {
          // debugger
          const props = {};
          const attrs = {};
          for (const key in propOptions) {
            // on开头的事件添加到props中
            if (key in propsData || key.startsWith("on")) {
              props[key] = propOptions[key];
            } else {
              attrs[key] = propOptions[key];
            }
          }
          return [props, attrs];
        }
        function mountComponent(newVnode, container, anchor) {
          // 组件配置对象
          const componentOptions = newVnode.type;
          let {
            props: propOptions,
            setup,
            render,
            data,
            beforeCreate,
            created,
            beforeMount,
            mounted,
            beforeUpdate,
            updated,
          } = componentOptions;
          // 解析出最终的props和attrs数据 没有定义在子组件props中的保存在attrs中
          const [props, attrs] = resolveProps(propOptions, newVnode.props);

          // slot 插槽的实现
          const slots = newVnode.children || {};
          // debugger
          // 生命周期调用beforeCreate
          beforeCreate && beforeCreate();
          // 将组件中的状态变更为响应式
          const state = data ? reactive(data()) : null;

          // 定义组件实例
          const instance = {
            state,
            props: shallowReactive(props),
            // 组件是否已经被挂载
            isMounted: false,
            // 组件渲染的内容
            subTree: null,
            slots,
            mounted: [],
          };
          // emit事件传递的实现
          function emit(event, ...payload) {
            // 根据约定对事件名称进行处理
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
            const handler = instance.props[eventName];
            if (handler) {
              // 调用事件处理函数传参
              handler(...payload);
            } else {
              console.warn(`${event}事件不存在`);
            }
          }

          const setupContext = { attrs, emit, slots, };
          // 射值当前组件实例
          setCurrentInstance(instance);
          // 避免意外修改props
          const setupResult = setup(
            shallowReadonly(instance.props),
            setupContext
          );
          // console.log(111111,setupResult)
          // debugger;
          // setup调用结束
          setCurrentInstance(null);
          // 存储setup返回的数据
          let setupState = null;
          if (typeof setupResult === "function") {
            if (render) {
              console.warn("setup和render同时存在，使用setup作为render");
            }
            render = setupResult;
          } else {
            // 返回值
            setupState = setupContext;
            // debugger
          }
          // debugger;
          // 创建渲染上下文对象
          const renderContext = new Proxy(instance, {
            get(t, k, r) {
              // 获取组件自身状态和props
              const { state, props } = t;
              // 读取自身转台数据
              if (state && k in state) {
                return state[k];
              } else if (k in props) {
                return props[k];
              } else if (setupState && k in setupState) {
                // 渲染上下文增加 setupState
                return setupState[k];
              } else if (k === "$slots") {
                return slots;
              } else {
                console.warn(`属性${k}不存在`);
              }
            },
            set(t, k, v, r) {
              const { state, props } = t;
              if (state && k in state) {
                state[k] = v;
              } else if (k in props) {
                props[k] = v;
              } else if (setupState && k in setupState) {
                // 渲染上下文增加 setupState
                setupState[k] = v;
              } else {
                console.warn(`属性${k}不存在`);
              }
            },
          });
          // 用于后续更新
          newVnode.component = instance;
          // 生命周期调用created
          // created && created.call(state)
          // 绑定上下文为代理对象
          created && created.call(renderContext);
          // 响应式更新
          effect(
            () => {
              // 改变render函数this指向，传递状态
              //  const subTree = render.call(state,state)
              debugger
              const subTree = render.call(renderContext, renderContext);
              if (!instance.isMounted) {
                // 生命周期调用beforeMount
                // beforeMount && beforeMount.call(state)
                beforeMount && beforeMount.call(renderContext);
                // 初次挂载
                patch(null, subTree, container, anchor);
                instance.isMounted = true;
                // 生命周期调用mounted
                //  mounted && mounted.call(state)
                instance.mounted &&
                  instance.mounted.forEach((hook) => hook.call(renderContext));
              } else {
                // 生命周期调用beforeUpdate
                // beforeUpdate && beforeUpdate.call(state)
                beforeUpdate && beforeUpdate.call(renderContext);
                // 更新操作
                patch(instance.subTree, subTree, container, anchor);
                // 生命周期调用updated
                // updated && updated.call(state)
                updated && updated.call(renderContext);
              }
              //  更新组件实例的子树
              instance.subTree = subTree;
            },
            {
              // 添加到微任务队列
              scheduler: flushJob,
            }
          );
        }

        function hasPropsChanged(prevProps, nextProps) {
          const nextKeys = Object.keys(nextProps);
          // 长度不一致有变化
          if (nextKeys.length !== Object.keys(prevProps).length) return true;
          for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i];
            // 同一属性值不同 有变化
            if (nextProps[key] !== prevProps[key]) return true;
          }
          return false;
        }
        function patchComponent(n1, n2, anchor) {
          // 获取组件实例
          const instance = (n2.component = n1.component);
          // 当前props
          const { props } = instance;
          // 检测props是否有发生变更
          if (hasPropsChanged(n1.props, n2.props)) {
            // props不一致
            const [nextProps] = resolveProps(n2.type.props, n2.props);
            // 更新props
            for (const k in nextProps) {
              props[k] = nextProps[k];
            }
            // 删除不存在的props
            for (const k in props) {
              if (!(k in nextProps)) delete props[k];
            }
          }
        }

        function patch(oldVnode, newVnode, container, anchor) {
          // console.log(oldVnode, newVnode);
          // 区分vnode类型
          if (oldVnode && oldVnode.type !== newVnode.type) {
            unmount(oldVnode);
            oldVnode = null;
          }
          // type为字符串 普通元素  h1 p div
          const { type } = newVnode;
          if (typeof type === "string") {
            // 挂载阶段
            if (!oldVnode) {
              mountElement(newVnode, container, anchor);
            } else {
              // 存在，更新阶段，打补丁
              console.log("更新oldVnode, newVnode", oldVnode, newVnode);
              patchElement(oldVnode, newVnode);

              // 新旧类型不同
            }
            // 对象为组件
          } else if (typeof type === "object") {
            if (!oldVnode) {
              // 挂载组件
              mountComponent(newVnode, container, anchor);
            } else {
              // 更新组件 此时子组件被动更新

              patchComponent(oldVnode, newVnode, anchor);
            }
          } else if (type === Text) {
            //文本
            if (!oldVnode) {
              const el = (newVnode.el = createText(newVnode.children));
              insert(el, container);
            } else {
              const el = (newVnode.el = oldVnode.el);
              if (oldVnode.children !== oldVnode.children) {
                setText(el, newVnode.children);
              }
            }
          } else if (type === Fragment) {
            if (!oldVnode) {
              newVnode.children.forEach((c) => patch(null, c, container));
            } else {
              patchChildren(oldVnode, newVnode, container);
            }
          }
        }
        function render(vnode, container) {
          if (vnode) {
            patch(container._vnode, vnode, container);
          } else {
            //
            console.log("卸载", container._vnode);
            if (container._vnode) {
              // 通过父元素移除子元素
              //  调用组件卸载前方法
              unmount(container._vnode);
              //  调用组件卸载后方法
              // 旧vnode存在，新vnode不存在，卸载阶段
              // 此方式不会移除注册的事件
              // container.innerHTML = "";
            }
          }
          container._vnode = vnode;
        }
        return {
          render,
        };
      }

      // 通过个性化配置能力，核心代码不依赖于平台特有API，实现兼容多平台
      const renderer = createRenderer({
        // 创建元素
        createElement(tag) {
          console.log("创建元素===" + tag);
          return document.createElement(tag);
          // return { tag };
        },
        // 设置元素文本节点
        setElementText(el, text) {
          // console.dir(el);
          console.log(`设置${el.nodeName}的文本内容：${text}`);
          el.textContent = text;
        },
        // 在给定的parent下添加指定元素
        insert(el, parent, anchor = null) {
          console.log(`将${el.nodeName}添加到${parent.nodeName}下`);
          parent.insertBefore(el, anchor);
        },
        createText(text) {
          return document.createTextNode(text);
        },
        setText(el, text) {
          el.nodeValue = text;
        },
        // 将属性挂载到dom 自定义差异解决方法
        patchProps(el, key, prevValue, nextValue) {
          // prop为事件
          if (/^on/.test(key)) {
            // // 移除之前的事件 绑定新事件
            // prevValue && el.removeEventListener(name,prevValue)
            // el.addEventListener(name,nextValue)
            // 优化绑定多个事件
            const invokers = el._vei || (el._vei = {});
            let invoker = invokers[key];
            const name = key.slice(2).toLowerCase();
            if (nextValue) {
              if (!invoker) {
                invoker = el._vei[key] = (e) => {
                  // 屏蔽在状态变更后注册的事件的触发
                  if (e.timeStamp < invoker.attached) return;
                  if (Array.isArray(invoker.value)) {
                    invoker.value.forEach((fn) => fn(e));
                  } else {
                    invoker.value(e);
                  }
                };
                invoker.value = nextValue;
                invoker.attached = performance.now();
                el.addEventListener(name, invoker);
              }
            } else if (invoker) {
              el.removeEventListener(name, invoker);
            }
            return;
          }
          // debugger
          if (key === "class") {
            // 该方式性能最优
            el.className = nextValue || "";
          } else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key];
            if (type === "boolean" && nextValue === "") {
              el[key] = true;
            } else if (key === "style") {
              for (let k in nextValue) {
                el[key][k] = nextValue[k];
              }
            } else {
              el[key] = nextValue;
            }
          } else {
            el.setAttribute(key, vnode.props[key]);
          }
        },
      });
      
      // let vnode = {type:'h1',children: 'hello'}
      // let vnode = {
      //   // 节点类型
      //   type: "div",
      //   // 节点属性
      //   props: normalizeProps({
      //     id: "box",
      //     // foo bar baz
      //     class: ["foo bar", { baz: false }],
      //     style: ["background: #ccc", { color: "red" }],
      //     onClick: [
      //       () => {
      //         console.log("p的点击事件1");
      //       },
      //       () => {
      //         console.log("p的点击事件2");
      //       },
      //     ],
      //   }),
      //   // 描述子元素
      //   children: [
      //     {
      //       type: "p",
      //       children: "这是p标签",
      //     },
      //   ],
      // };


      let app = document.getElementById("app");



      // let app = {
      //   type: "root",
      // };
      // console.log(666, vnode);
      // renderer.render(vnode, app);
      // // 卸载
      // renderer.render(null, app);
      // setTimeout(() => {
      //   renderer.render({ type: "h1", children: "这是h1" }, app);
      // }, 2000);
      // console.dir(app);
      // renderer.render(node, app);

      // const bol = ref(false);
      // let node = {
      //   // 节点类型
      //   type: "div",
      //   key: "123",
      //   // 节点属性
      //   props: normalizeProps({
      //     id: bol.value ? "box" : "",
      //     // foo bar baz
      //     class: ["foo bar", { baz: false }],
      //     style: ["background: #ccc", { color: bol.value ? "red" : "green" }],
      //     onClick: [
      //       () => {
      //         console.log("p的点击事件1");

      //         node = {
      //           // 节点类型
      //           type: "div",
      //           key: "123",
      //           // 节点属性
      //           props: normalizeProps({
      //             id: "box",
      //             // foo bar baz
      //             class: ["foo bar", { baz: false }],
      //             style: ["background: #ccc", { color: "red" }],
      //             onClick: [
      //               () => {
      //                 console.log("p的点击事件1");
      //                 node = bol.value = true;
      //               },
      //             ],
      //           }),
      //           children: [
      //             {
      //               type: "div",
      //               key: "p-1",
      //               children: "p-1",
      //             },
      //             {
      //               type: "div",
      //               key: "p-3",
      //               children: "p-3",
      //             },
      //             {
      //               type: "div",
      //               key: "p-4",
      //               children: "p-4",
      //             },
      //             {
      //               type: "div",
      //               key: "p-2",
      //               children: "p-2",
      //             },
      //             {
      //               type: "div",
      //               key: "p-7",
      //               children: "p-7",
      //             },
      //             {
      //               type: "div",
      //               key: "p-5",
      //               children: "p-5",
      //             },
      //           ],
      //         };
      //         bol.value = true;
      //       },
      //     ],
      //   }),
      //   children: [
      //     {
      //       type: "div",
      //       key: "p-1",
      //       children: "p-1",
      //     },
      //     {
      //       type: "div",
      //       key: "p-2",
      //       children: "p-2",
      //     },
      //     {
      //       type: "div",
      //       key: "p-3",
      //       children: "p-3",
      //     },
      //     {
      //       type: "div",
      //       key: "p-4",
      //       children: "p-4",
      //     },
      //     {
      //       type: "div",
      //       key: "p-6",
      //       children: "p-6",
      //     },
      //     {
      //       type: "div",
      //       key: "p-5",
      //       children: "p-5",
      //     },
      //   ],
      // };







      // effect(() => {
      //   console.log("effect执行重新渲染", bol.value, node);
      //   renderer.render(node, app);
      // });

      // // 组件化
      // const MyComponent = {
      //   name: "MyComponent",
      //   props: {
      //     title: String,
      //   },
      //   data: () => {
      //     return {
      //       foo: "child",
      //     };
      //   },
      //   mounted() {
      //     console.log("mounted", this);
      //   },
      //   // vu3新增 只执行一次
      //   // setup(){
      //   //   // 返回值可以为函数 该函数将作为render
      //   //   return () => {
      //   //     return {
      //   //     type: 'div',
      //   //     children: `组件自身的状态++++${this.foo}-----父组件传递的状态++++${this.title}`
      //   //   }
      //   //   }
      //   // },
      //   setup(props, setupContext) {
      //     // let { slots,emit,attrs,expose } = setupContext

      //     let { emit, attrs, slots } = setupContext;
      //     console.log(555, slots, emit);
      //     emit("change", "childdata");
      //     const count = ref(0);

      //     onMounted(() => {
      //       console.log("child挂载1");
      //     });
      //     onMounted(() => {
      //       console.log("child挂载2");
      //     });

      //     return function (){
      //       return {
      //         type: "div",
      //         children: `组件自身的状态++++${this.foo}-----父组件传递的状态++++${this.title}-----`,
      //       }
      //     };
      //   },
      //   // render(){
      //   //   return {
      //   //     type: 'div',
      //   //     children: `组件自身的状态++++${this.foo}-----父组件传递的状态++++${this.title}----- setup返回值${this.count}`
      //   //   }
      //   // }
      // };

      // // 插槽的实现
      // // <template>
      // //   <header>
      // //     <slot name="header"/>
      // //   </header>
      // //   <div>
      // //     <slot name="body" />
      // //   </div>
      // //   <footer>
      // //     <slot name="footer"/>
      // //   </footer>
      // // </template>
      // // <MyComponent title="父组件的title" :val="val">
      // // <template #header>
      // //   <h1>我是标题</h1>
      // // </template>
      // // <template #body>
      // //   <h1>我是内容</h1>
      // // </template>
      // // <template #footer>
      // //   <p>我是footer</p>
      // // </template>
      // // </MyComponent>
      // // 组件vnode
      // function onChange(data) {
      //   console.log("父组件接收子组件数据----", data);
      // }
      // const componentVnode = {
      //   type: MyComponent,
      //   props: {
      //     title: "父组件的title",
      //     val: "123",
      //     onChange: onChange,
      //   },
      //   children: {
      //     header() {
      //       return { type: "h1", children: "我是标题" };
      //     },
      //     body() {
      //       return { type: "div", children: "我是内容" };
      //     },
      //     footer() {
      //       return { type: "p", children: "我是footer" };
      //     },
      //   },

      //   // setup(){
      //   //   onMounted(() => {
      //   //     console.log('父组件挂载')
      //   //   })
      //   // }
      // };

      // MyComponent组件编译结果
      // function render(){
      //   return [
      //     {
      //       type: 'header',
      //       children:[this.$slots.header()]
      //     },
      //     {
      //       type: 'body',
      //       children:[this.$slots.body()]
      //     },
      //     {
      //       type: 'footer',
      //       children:[this.$slots.footer()]
      //     },
      //   ]
      // }

      // renderer.render(componentVnode, app);
      exports.renderer = renderer
      exports.normalizeProps = normalizeProps
      exports.onMounted = onMounted
      return exports
      
}({}))