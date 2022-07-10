import { isNumber, isString } from '@vue/shared'
import { createVNode, isSameVNode, ShapeFlags, Text } from './createVNode'

function getSequence(arr) {
	let len = arr.length
	let result = [0]
	const p = Array(len).fill(0) // p中存的什么无所谓
	let lastIndex
	let start, end, middle
	for (let i = 0; i < len; i++) {
		const arrI = arr[i]
		if (arrI !== 0) {
			// 0在vue3中意味着新增的节点，这个不计入最长递增子序列
			lastIndex = result.at(-1) // 数组中最后一项 就是最大的那个索引
			if (arr[lastIndex] < arrI) {
				// 说明当前这一项比结果集中最后一项大 则直接把索引追加到结果集中
				p[i] = lastIndex // 存的是索引
				result.push(i)
				continue
			}
			// 否则，找到比当前项大的那个索引 	// 二分查找
			start = 0
			end = result.length - 1
			while (start < end) {
				middle = Math.floor((start + end) / 2)
				if (arr[result[middle]] < arrI) {
					start = middle + 1
				} else {
					end = middle
				}
			}
			if (arrI < arr[result[end]]) {
				p[i] = result[end - 1]
				result[end] = i
			}
		}
	}
	console.log(p)
	// 倒序追溯 先取到结果集的最后一项
	let i = result.length
	let last = result[i - 1]
	while (i--) {
		//检索后停止
		result[i] = last // 第一次最后一项肯定是正确的
		last = p[last] // 根据最后一项向前追溯
	}

	return result
}

export function createRenderer(options) {
	//用户可以调用此方法传入对应的渲染选项

	let {
		createElement: hostCreateElement,
		createTextNode: hostCreateTextNode,
		insert: hostInsert,
		remove: hostRemove,
		querySelector: hostQuerySelector,
		parentNode: hostParentNode,
		nextSibling: hostNextSibling,
		setText: hostSetText,
		setElementText: hostSetElementText,
		patchProp: hostPatchProp,
	} = options

	function normalizeVNode(children, i) {
		console.log(children[i])

		if (isString(children[i]) || isNumber(children[i])) {
			// 给文本加标识，不能给字符串加，所以只能给对象加
			children[i] = createVNode(Text, null, children[i]) // 需要换掉以前存的内容
		}
		return children[i]
	}

	function mountChildren(children, container) {
		// debugger
		for (let i = 0; i < children.length; i++) {
			let child = normalizeVNode(children, i)
			// child 可能是文本内容，我们需要把文本也变成虚拟节点

			patch(null, child, container) // 递归渲染子节点
		}
	}

	function patchProps(oldProps, newProps, el) {
		oldProps = oldProps || {}
		newProps = newProps || {}
		for (let key in newProps) {
			// 循环新的覆盖老的
			hostPatchProp(el, key, oldProps[key], newProps[key])
		}

		for (let key in oldProps) {
			// 老得没有需要删除
			if (newProps[key] == null) {
				hostPatchProp(el, key, oldProps[key], null)
			}
		}
	}

	function mountElement(vnode, container, anchor) {
		// console.log(vnode, container)

		let { type, props, children, shapeFlag } = vnode
		// console.log(type, props, children, shapeFlag)
		// 因为我们后续需要比对虚拟节点的差异更新页面，所以需要保留对应的真实节点
		let el = (vnode.el = hostCreateElement(type))

		if (props) {
			// 如果有属性 就去更新属性 {a:1, b:2} => {c:3}
			patchProps(null, props, el)
		}

		// children不是数组就是文本
		if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
			hostSetElementText(el, children)
		}
		if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
			mountChildren(children, el)
		}
		hostInsert(el, container, anchor)
	}

	function ProcessText(n1, n2, container) {
		if (n1 === null) {
			hostInsert((n2.el = hostCreateTextNode(n2.children)), container)
		}
	}

	function unmountChildren(children) {
		children.forEach(child => {
			unmount(child)
		})
	}

	function patchKeyedChildren(c1, c2, el) {
		// 比较c1和c2的差异再去更新el
		// O(n)的算法
		// 方向就是尽可能复用节点，然后找到变化的位置 优化：原则上的diff算法是拿新的去里面找
		// 先考虑顺序相同的情况：追加或者删除
		let i = 0
		let e1 = c1.length - 1
		let e2 = c2.length - 1
		// 有任何一方比对完成之后就无需比较了
		while (i <= e1 && i <= e2) {
			const n1 = c1[i]
			const n2 = c2[i]
			if (isSameVNode(n1, n2)) {
				patch(n1, n2, el)
			} else {
				break
			}
			i++
		}
		console.log(i, e1, e2)

		while (i <= e1 && i <= e2) {
			const n1 = c1[e1]
			const n2 = c2[e2]
			if (isSameVNode(n1, n2)) {
				patch(n1, n2, el)
			} else {
				break
			}
			e1--
			e2--
		}

		console.log(i, e1, e2)

		// 我们可以确定的是 但i的值大于e1 说明 我们已经把老的全部比较完了 但是新的可能还没比较完
		// i 到 e2 这段是就是新的节点

		if (i > e1) {
			// 新的多了
			if (i <= e2) {
				while (i <= e2) {
					const nextPos = e2 + 1
					// 看一下 下一项是否在数组内 如果在数组内说明有参照物
					console.log(c2, nextPos)
					let anchor = c2.length <= nextPos ? null : c2[nextPos].el
					patch(null, c2[i], el, anchor) // 插入新的节点 找到参照物再插入
					i++
				}
			}
		} else if (i > e2) {
			// 老的多，新的少
			//  a b c d e f
			//  a b c d
			if (i <= e1) {
				while (i <= e1) {
					unmount(c1[i])
					i++
				}
			}
		} else {
			// 乱序比对
			// a b [c d e q] f g
			// a b [e c d h] f g  // i= 2 e1 =4 e2 = 4
			console.log(i, e1, e2)

			let s1 = i // s1=> e1 老的需要比对的节点
			let s2 = i // s2=> e2 新的需要比对的节点

			// vue2中用的是新的找老的， vue3是用老的找新的

			let toBePatched = e2 - s2 + 1 // 我们需要操作的次数
			const keyToNewIndexMap = new Map()
			for (let i = 0; i <= e2; i++) {
				keyToNewIndexMap.set(c2[i].key, i)
			}

			const seq = new Array(toBePatched).fill(0)

			for (let i = s1; i <= e1; i++) {
				const oldVnode = c1[i]
				const newIndex = keyToNewIndexMap.get(oldVnode.key) // 用老的去找，看看新的里面有没有
				if (newIndex == null) {
					unmount(oldVnode)
				} else {
					// 新的老的都有，我就记录下来当前对应的位置 就可以判断出哪些数据不需要移动
					// 用新的位置和老的位置做一个关联
					seq[newIndex - s2] = i + 1 // 拿到新的数组的索引
					// +1是为了保证之前的初始化的0不被真实位置的0所混淆

					patch(oldVnode, c2[newIndex], el) // 1. 如果新老都有，我们需要比较两个节点的差异，再去比较他们的子节点
				}
			}
			// console.log(seq)
			let increase = getSequence(seq) // 计算出不用动的索引（也就是最长递增子序列的坐标）

			console.log(increase)

			let j = increase.length - 1

			//1.然后按照新的位置重新排列，并且将新增的元素插入到新的位置
			// 我们已知正确的顺序 所以我们可以倒叙插入 appendChild
			for (let i = toBePatched - 1; i >= 0; i--) {
				const currentIndex = s2 + i // 找到对应的索引
				const child = c2[currentIndex] // q
				const anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null
				// 判断是要移动还是新增
				if (seq[i] === 0) {
					//如果===0 说明是新增的
					//如果vnode有el 说明之前渲染过了，没有就是新增的
					// 新增
					patch(null, child, el, anchor)
				} else {
					// 这里面应该尽量减少需要移动的节点：最长递增子序列
					if (i !== increase[j]) {
						// 通过序列来进行比对，找到哪些需要移动，跳过不需要移动的
						// 如果不是最长递增子序列的第一个元素，那么就需要移动
						hostInsert(child.el, el, anchor) // 如果有el说明之前新增过
					} else {
						j-- // 这里是不做任何操作
					}
				}
			}
		}
	}

	function patchChildren(n1, n2, el) {
		let c1 = n1.children
		let c2 = n2.children
		const prevShapeFlag = n1.shapeFlag
		const nextShapeFlag = n2.shapeFlag
		// 开始比较子节点的情况 // 案例 5vnode.html
		// 新儿子	旧儿子	操作方式
		// 文本	数组	（删除老儿子，设置文本内容）
		// 文本	文本	（更新文本即可）
		// 文本	空	（更新文本即可) 与上面的类似
		// 数组	数组	（diff算法）
		// 数组	文本	（清空文本，进行挂载）
		// 数组	空	（进行挂载） 与上面的类似
		// 空	数组	（删除所有儿子）
		// 空	文本	（清空文本）
		// 空	空	（无需处理）

		if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
			if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
				//  文本	数组	（删除老儿子，设置文本内容）
				unmountChildren(c1)
			}
			if (c1 !== c2) {
				hostSetElementText(el, c2)
			}
		} else {
			if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
				// 之前是数组
				if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
					// 前后都是数组
					// 新的是数组
					// diff算法
					patchKeyedChildren(c1, c2, el)
				} else {
					// 现在无了
					// 空	数组	（删除所有儿子）
					unmountChildren(c1)
				}
			} else {
				// 数组	文本	（清空文本，进行挂载）
				// 数组	空	（进行挂载） 与上面的类似
				// 空	数组	（删除所有儿子）
				// 空	文本	（清空文本）
				if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
					hostSetElementText(el, '')
				}
				if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
					//前后都是数组
					mountChildren(c2, el)
				}
			}
		}
	}

	function patchElement(n1, n2) {
		//n1和n2能复用用 说明dom就不用删除了
		let el = (n2.el = n1.el) // 1.节点复用
		let oldProps = n1.props
		let newProps = n2.props
		patchProps(oldProps, newProps, el) // 2.更新属性

		//3. 更新子节点
		patchChildren(n1, n2, el)
	}

	function processElement(n1, n2, container, anchor) {
		if (n1 === null) {
			mountElement(n2, container, anchor)
		} else {
			// 比较元素
			patchElement(n1, n2)
		}
	}

	function unmount(vnode) {
		hostRemove(vnode.el)
	}

	function patch(n1, n2, container, anchor = null) {
		// 判断标签名和对应的key是否相同，如果一样就说明是同一个节点
		if (n1 && !isSameVNode(n1, n2)) {
			unmount(n1)
			n1 = null //将n1 重置为null 此时会走n2的初始化
		}

		// 看n1是null 说明没有之前的虚拟节点
		// 如果n1有值 说明要走diff算法
		const { type, shapeFlag } = n2
		switch (type) {
			case Text:
				ProcessText(n1, n2, container)
				break

			default:
				if (shapeFlag & ShapeFlags.ELEMENT) {
					processElement(n1, n2, container, anchor)
					break
				}
		}
	}

	function render(vnode, container) {
		if (vnode == null) {
			// 卸载元素
			if (container._vnode) {
				unmount(container._vnode)
			}
		} else {
			// 更新
			patch(container._vnode || null, vnode, container)
		}

		container._vnode = vnode // 第一次渲染的时候会把vnode挂载到container上
	}
	return {
		render,
	}
}
