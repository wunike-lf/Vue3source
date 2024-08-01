// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Document</title>
// </head>
// <body>
//   <div id="app"></div>
//   <script>
//     let arr = [1,2]

// arr[100] = 99
// arr.forEach((item,index) => {
//   console.log(arr[index])
// })

// console.log(arr.join())

//     // 响应式系统的基本实现
//     // let activeEffect
//     // let obj = {name: '晓明',age: 18}
//     // 收集副作用函数
//     // let bucket = new Set()
//     // let proxyObj = new Proxy(obj,{
//     //   get(target,key,receiver){
//     //     console.log(target,key,receiver)
//     //     if(activeEffect){
//     //       bucket.add(activeEffect)
//     //     }
//     //     return target[key]
//     //   },
//     //   set(target,key,val,receiver){
//     //     console.log(target,key,val,receiver)
//     //     target[key] = val
//     //     bucket.forEach(fn => fn())
//     //   }
//     // })



//     // function effect(fn){
//     //   activeEffect = fn
//     //   fn()
//     // }

//     // effect(() => {
//     //   document.getElementById('app').innerText = proxyObj.name
//     // })

//     // setTimeout(() => {
//     //   proxyObj.name = 123 
//     // },2000) 

// // 代理  拦截并重新定义一个对象的基本操作 相应系统应该拦截一切读取操作
// // 优化  target->key->effect 将副作用函数与操作对象对应的key简历绑定关系 避免无意义的执行
// // 收集副作用函数 WeakMap弱引用不影响垃圾回收
// // commputed 通过指定lazy为true 标识为懒执行的effect 不立即执行副作用函数 读取值的时候effect才执行 懒计算   缓存值
// // watch观测一个响应式数据  
// // watch computed都是基于以下effect实现
// // proxy get set apply(拦截函数的调用) deleteProperty(删除 delete`) has(拦截in 操作) ownKeys(拦截for in操作)
// // symbol.iterator
// // effect(getter,{
// //   lazy: false,
// //   scheduler(){

// //   }
// // })
// let bucket = new WeakMap()
// let activeEffect
// // 栈结构 解决effect嵌套 
// let effectStack = []
// let data = {name: '晓明',age: 18}

// //  // 定义任务队列 
// let jobQueue = new Set();
// // 使用微任务实现任务调度
// let p = Promise.resolve();
// // 标志任务队列是否正在刷新
// let isFlushing = false;
// // 触发类型
// let triggerType = {
//   SET: "SET",
//   ADD: "ADD",
//   DELETE: "DELETE",
// };


// // 代表是否进行追踪  数组push 方法执行的标志
// let shouldTrack = true
// // for in操作的标记
// let INERATE_KEY = Symbol();
// // 批量更新
// function flushJob() {
//   if (isFlushing) return;
//   isFlushing = true;
//   p.then(() => {
//     jobQueue.forEach((job) => job());
//   }).finally(() => {
//     isFlushing = false;
//   });
// }

// let proxyObj = new Proxy(data,{
//   get(target,key,receiver){
//     console.log(target,key,receiver)
//     if(activeEffect){
//       bucket.add(activeEffect)
//     }
//     return target[key]
//   },
//   set(target,key,val,receiver){
//     console.log(target,key,val,receiver)
//     target[key] = val
//     bucket.forEach(fn => fn())
//   }
// })



// // vue组件的渲染函数在effect中执行 组件嵌套会effect嵌套
// // effect(() => {
// //    Foo.render()
// //    effect(() => {
// //     Child.render()
// //    })
// // })







//   </script>
// </body>
// </html>

var MyVue =(function(exports){
   // 执行effect  触发读取操作  存储副作用函数
      // 1.设置不存在的属性副作用函数会执行  将副作用函数与属性进行绑定 使用weakMap
      // 副作用函数栈 解决effect嵌套
      // computed lazy  缓存值  调度器配合缓存值
      // 处理watch的竞态问题
      // 通过Reflect解决读取对象中get属性时的this指向
      // 常规对象 异质对象 对象语义有内部方法指定 obj.xxx 内部调用[[Get]] 一个对象必须有11个必要的内部方法 函数对象 必须有[[call]]
      // proxy的get set可以由用户指定 deleteProperty拦截删除操作
      // 响应式系统应该拦截一切读取操作  obj.xxx  in(has) for  in
      // 数组是异质对象 [[DefineOwnProperty]]实现与普通对象不同
      // for of 调用的[Symbol.iterator] arr.values() 返回的是数组内建的迭代器 
      let activeEffect;
      let effectStack = [];
      // let bucket = new Set()
      let bucket = new WeakMap();
      let obj = { num1: 1, num2: 2 };
      // 定义任务队列
      let jobQueue = new Set();
      let p = Promise.resolve();
      // 标志任务队列是否正在刷新
      let isFlushing = false;
      // 触发类型
      let triggerType = {
        SET: "SET",
        ADD: "ADD",
        DELETE: "DELETE",
      };
      // 代表是否进行追踪  数组push 方法执行的标志
      let shouldTrack = true
      // for in操作的标记
      let INERATE_KEY = Symbol();
      // 批量更新
      function flushJob() {
        if (isFlushing) return;
        isFlushing = true;
        p.then(() => {
          jobQueue.forEach((job) => job());
        }).finally(() => {
          isFlushing = false;
        });
      }

      // 存储副作用
      function track(target, key) {
        if (!activeEffect || !shouldTrack) return target[key];
        let depsMap = bucket.get(target);
        if (!depsMap) {
          bucket.set(target, (depsMap = new Map()));
        }
        let deps = depsMap.get(key);
        if (!deps) {
          depsMap.set(key, (deps = new Set()));
        }
        deps.add(activeEffect);
        activeEffect.deps.push(deps);
      }
      function trigger(target, key, type,newVal) {
        let depsMap = bucket.get(target);
        if (!depsMap) return;
        let effects = depsMap.get(key);
        // for  in
        let iterateEffects = depsMap.get(INERATE_KEY);
        const effectsToRun = new Set(effects);
        // 导致无线循环
        effects &&
          effects.forEach((fn) => {
            // 如果触发执行的副作用函数与当前正在执行的相同，不触发
            if (fn !== activeEffect) {
              effectsToRun.add(fn);
            }
          });
        // for in 只有新增 删除操作才触发forin的副作用函数重新执行，避免不必要的更新
        if (type === "ADD" || type === "DELETE") {
          iterateEffects &&
            iterateEffects.forEach((fn) => {
              // 如果触发执行的副作用函数与当前正在执行的相同，不触发
              if (fn !== activeEffect) {
                effectsToRun.add(fn);
              }
            });
        }


        
        // 操作目标对象为数组 去除并执行与length相关的副作用函数
        if (type === "ADD" && Array.isArray(target)) {
          const  lengthEffects = depsMap.get('length')
          lengthEffects &&
          lengthEffects.forEach((fn) => {
              // 如果触发执行的副作用函数与当前正在执行的相同，不触发
              if (fn !== activeEffect) {
                effectsToRun.add(fn);
              }
            });
        }


        // 操作目标对象为数组 ,并且修改了length 当设置数组length值大于原数组length 时并不影响原数组数据，
        // 小于length的副作用不需要执行
        if (Array.isArray(target) && key === 'length') {
          // 只对于大于或等于新的length值得元素取出副作用函数执行
          depsMap.forEach((effects,key) => {
            if(key >= newVal){
              effects.forEach((fn) => {
              // 如果触发执行的副作用函数与当前正在执行的相同，不触发
              if (fn !== activeEffect) {
                effectsToRun.add(fn);
              }
            });
            }
          }) 
        }






        effectsToRun.forEach((fn) => {
          if (fn.options.scheduler) {
            // 移交副作用函数的控制全给用户
            fn.options.scheduler(fn);
          } else {
            fn();
          }
        });
      }

      
      // 避免副作用函数遗留
      function cleanup(effectFn) {
        for (let i = 0; i < effectFn.deps.length; i++) {
          const deps = effectFn.deps[i];
          // console.log(555,deps)
          deps.delete(effectFn);
        }
        effectFn.deps.length = 0;
      }
      // 响应式系统
      function effect(fn, options = {}) {
        const effectFn = function () {
          // console.log("副作用函数执行");
          cleanup(effectFn);
          activeEffect = effectFn;
          effectStack.push(effectFn);
          let res = fn();
          effectStack.pop();
          activeEffect = effectStack[effectStack.length - 1];
          return res;
        };
        // 配置项挂载副作用函书上
        effectFn.options = options;
        // 存储所有与该副作用函数相关联的依赖集合
        effectFn.deps = [];
        if (!options.lazy) {
          effectFn();
        }
        return effectFn;
      }
      // 组件渲染是在effect中执行的 component.render()
      let effn = effect(
        () => {
          console.log(1111);
          document.getElementById("app").innerHTML = data.num1;
        },
        {
          // 不希望立即执行 计算属性
          lazy: true,
          // 调度执行
          scheduler(fn) {
            // 使用微任务 或红任务 改变副作用函数执行时机
            jobQueue.add(fn);
            flushJob();
          },
        }
      );
      // 实现计算属性
      function computed(getter) {
        // 缓存值
        let value,
          dirty = true;
        const effectfn = effect(getter, {
          lazy: true,
          scheduler() {
            if (!dirty) {
              dirty = true;
              //计算属性依赖的数据变化重新渲染
              trigger(data, "value");
            }
          },
        });
        const obj = {
          get value() {
            if (dirty) {
              value = effectfn();
              dirty = false;
            }
            // 读取value 进行追踪
            track(data, "value");
            return value;
          },
        };
        return obj;
      }

      function traverse(obj, seen = new Set()) {
        if (typeof obj !== "object" || obj === null || seen.has(obj)) return;
        seen.add(obj);
        // 递归取值 建立响应式
        for (let k in obj) {
          traverse(obj[k], seen);
        }
        return obj;
      }
      // 实现watch 接收响应式对象，getter函数
      function watch(source, cb, options = {}) {
        let getter, newVal, oldVal, cleanup; //存储过期cleanup函数
        function onInvalidate(fn) {
          cleanup = fn;
        }

        typeof source === "function"
          ? (getter = source)
          : (getter = () => traverse(source));
        let job = () => {
          newVal = effectFn();
          // 先调用过期回调
          if (cleanup) {
            cleanup();
          }
          cb(newVal, oldVal, onInvalidate);
          oldVal = newVal;
        };
        let effectFn = effect(
          // 触发读取建立联系
          getter,
          {
            scheduler: () => {
              if (options.flush === "post") {
                Promise.resolve().then(job);
              } else {
                job();
              }
            },
          }
        );
        if (options.immediate) {
          job();
        } else {
          oldVal = effectFn();
        }
      }
     
      const arrayInstrumentations = {}
      // 用户可能使用原始对象去做检测，需要重写以下方法得到正确的结果
      ;['includes','indexOf','lastIndexOf'].forEach(method => {
        const originMethod = Array.prototype[method]
        arrayInstrumentations[method] = function(...args) {
          // debugger
          // 先在代理对象中找
          let res = originMethod.apply(this,args)
          if(res === false || res === -1){
            // 从原始数组中找
            res = originMethod.apply(this.raw,args)
          }
          return res
        }
      })
      
      // 以下方法会读取length导致追踪，立标识 阻断length
      ;['push','pop','shift','unshift','splice'].forEach(method => {
        const originMethod = Array.prototype[method]
        arrayInstrumentations[method] = function(...args) {
          shouldTrack = false

          let res = originMethod.apply(this,args)
          shouldTrack = true
          return res
        }
      })




      
      function createReactive(obj,isShallow = false,isReadonly = false) {
        return new Proxy(obj, {
          get(target, key, receiver) {
            
            // console.log(key)
            if (key === "raw") {
              return target;
            }
            // 解决数组include  this指向问题
            if(Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)){
              return Reflect.get(arrayInstrumentations,key,receiver)
            }
            // 非只读情况收集  基于性能，避免意外错误不予迭代器建立副作用联系(数组)
            if(!isReadonly && typeof key !== 'Symbol'){
              track(target, key);
            }
            const res = Reflect.get(target, key, receiver);

            if(isShallow){
              return res
            }
            // 递归代理
            if(typeof res === 'object' && res !== null){
              // 数据为只读，递归包装 
              return isReadonly ? readonly(rea) : reactive(res)
            }
            // return target[key];
            return res
            
          },
          set(target, key, newVal, receiver) {
            // console.log(target === receiver.raw)
            if(isReadonly){
              console.warn(`只读属性${key}`)
              return true
            }
            let oldVal = target[key];

            // 区分新增属性还是修改属性
            const type = Array.isArray(target) 
            // 如果是数组检测设置的索引值是否小于数组长度
            ? Number(key) < target.length ? triggerType.SET : triggerType.ADD
            : Object.prototype.hasOwnProperty.call(target, key)
              ? triggerType.SET
              : triggerType.ADD;
            target[key] = newVal;
            const res = Reflect.set(target, key, newVal, receiver);
            // 只有当receiver是target的代理对象时才触发更新，屏蔽由原型引起的更新避免不必要的渲染
            // console.log(123,target,receiver.raw)
            if (target === receiver.raw) {
              // 校验新旧值，避免重复执行副作用 并且不都是NAN的时候才触发
              if (
                oldVal !== newVal &&
                (oldVal === oldVal || newVal === newVal)
              ) {
                trigger(target, key, type,newVal);
              }
            }
            return res;
          },
          // 删除
          deleteProperty(target, key) {
            if(isReadonly){
              console.warn(`只读属性${key}`)
              return true
            }
            console.log("删除", target, key);
            let okey = Object.prototype.hasOwnProperty.call(target, key);
            let res = Reflect.deleteProperty(target, key);
            console.log(okey, res);
            if (res && okey) {
              trigger(target, key, triggerType.DELETE);
            }
            return res;
          },
          // 拦截 in
          has(target, key) {
            track(target, key);
            return Reflect.has(target, key);
          },
          // 拦截for in 如果为数组 使用length 建立响应联系
          ownKeys(target) {
            track(target, Array.isArray(target) ? 'length' : INERATE_KEY);
            return Reflect.ownKeys(target);
          },
        });
      }
      // reactive
      const reactiveMap = new Map()
      function reactive(obj){
        // 有限通过原始对象寻找之前创建的代理对象，防止重复创建
        const existionProxy = reactiveMap.get(obj)
        if(existionProxy) return existionProxy
        const proxy = createReactive(obj)
        reactiveMap.set(obj,proxy)
        return proxy
      }
      function shallowReactive(obj){
        return createReactive(obj,true)
      }
      function readonly(obj){
        return createReactive(obj,false,true)
      }
      function shallowReadonly(obj){
        return createReactive(obj,true,true)
      }

      function ref(val){
        let obj = {
          value: val
        }
        // 添加 __v_isRef 用于判断是否为ref
        Object.defineProperty(obj,'__v_isRef',{
          value: true
        })
        return reactive(obj)
      }
      // 解决...响应式数据变为普通数据相应丢失 使用访问器属性读取代理对象的值
      function toRef(obj,key){
        const wrapper = {
          get value(){
            return obj[key]
          },
          set value(val){
            obj[key] = val
          }
        }
        Object.defineProperty(wrapper,'__v_isRef',{
          value: true
        })
        return wrapper
      }

      function toRefs(obj){
        const res = {}
        for(let key in obj){
          res[key] = toRef(obj,key)
        }
        return res
      }
      // vue中setup函数本质上就是调用的proxyRefs({...toRefs(obj)})
      // 优化在模板中使用 不需要.value读取值
      function proxyRefs(target){
        return new Proxy(target,{
          get(target,key,receiver){
            const value = Reflect.get(target,key,receiver)
            return value.__v_isRef ? value.value : value
          },
          set(target,key,newVal,receiver){
            const value = target[key]
            if(value.__v_isRef){
              value.value = newVal
              return true
            }
            return Reflect.set(target,key,newVal,receiver)
          }
        })
      }


      
      // let data = reactive({ num1: 1, num2: 5 });
      // watch(data, () => {
      //   console.log("数据变化了");
      // });

      // watch(
      //   () => data.num1,
      //   async (newVal, oldVal, onInvalidate) => {
      //     console.log("数据变化了1", newVal, oldVal);
      //     let expired = false;
      //     onInvalidate(() => {
      //       expired = true;
      //     });
      //     let img = document.getElementById("img");
      //     let data = await fetch("https://loremflickr.com/800/600").then(
      //       (res) => res.blob()
      //     );
      //     let uri = URL.createObjectURL(data);

      //     if (!expired) {
      //       img.src = uri;
      //     }
      //   },
      //   {
      //     immediate: true,
      //     flush: "pre", //pre watch创建时立即执行  'post'放到微任务 dom更新后执行 sync同步执行
      //   }
      // );

      //  let cc = computed(() => data.num1 + data.num2)
      //  console.log('计算属性',cc.value)
      //  console.log('计算属性',cc.value)
      //  console.log('计算属性',cc.value)
      // effect(() => {
      //   console.log(1111)
      //   document.getElementById('app').innerHTML = data.num1
      // })
      // data.num1= 123
      // setTimeout(() => {
      //   data.num1 = 555;
      //   effn();
      //   // console.log('计算属性',cc.value)
      //   // console.log(data)
      //   // console.log(activeEffect)
      // }, 20)

      // in
      // effect(() => {
      //   "num1" in data;
      //   console.log("拦截in操作");
      // });
      // // for in
      // effect(() => {
      //   for (let k in data) {
      //     console.log("拦截for in" + k);
      //   }
      // });
      // setTimeout(() => {
      //   // data.num1 = 12333
      //   // data.num3 = 123
      //   delete data.num1;
      // }, 2000);

      // 拦截函数
      // function fun(name){
      //   console.log(name)
      // }
      // let funProxy = new Proxy(fun,{
      //   apply(target,thisArg,argArray){
      //     target.call(thisArg,...argArray)
      //   }
      // })
      // funProxy('xiao')


      // const obj1 = {}
      // const obj2 = {name: 'xiao'}
      // const p1 = reactive(obj1)
      // const p2 = reactive(obj2)
      // Object.setPrototypeOf(p1,p2)
      // effect(() => {
      //   console.log(p1.name)
      // })
      // p1.name = 'ming'
      // console.log(p1)



      // let obj1 = reactive({foo:{name:'xiao'}})
      // let obj1 = shallowReactive({foo:{name:'xiao'}})
      // effect(() => {
      //   console.log(obj1.foo.name)
      // })
      // setTimeout(() => {
      //   obj1.foo.name = '455'
      //   console.log(obj1)
      // },5000)
      // 非原始值的响应式

        // const obj5 = readonly({name:'xiao'})
        // effect(() => {
        //   obj5.name
        // })
        // obj5.name = 'kjk'
      // let oo = {}
      // const arr = reactive([oo,1])
      
      // effect(() => {
      //   console.log(arr.indexOf(oo))
      // })
      // arr[1] = 2

      // let aa = [oo,1]

      // console.log(aa.indexOf(oo))

      // let num = ref(1)

      // effect(() => {
      //   console.log(num.value)
      // })

      // num.value = 123

      exports.ref = ref
      exports.toRef = toRef
      exports.toRefs = toRefs
      exports.reactive = reactive
      exports.shallowReactive = shallowReactive
      exports.readonly = readonly
      exports.shallowReadonly = shallowReadonly
      exports.proxyRefs = proxyRefs
      exports.effect = effect
      exports.watch = watch
      exports.computed = computed

    
  return exports
}({}))