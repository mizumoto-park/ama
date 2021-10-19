#include "node.hpp"
#include "../script/jsenv.hpp"
#include <vector>
#include "../util/jc_array.h"
namespace ama {
	static inline void mark(std::vector<ama::Node*>& Q, ama::Node* nd) {
		if ( nd && !(nd->tmp_flags & ama::TMPF_GC_MARKED) ) {
			nd->tmp_flags |= ama::TMPF_GC_MARKED;
			Q--->push(nd);
		}
	}
	intptr_t gc() {
		//mark: if nd is alive, so is nd.p
		//so we only mark root nodes and only propagate along c / s
		std::vector<ama::Node*> Q{};
		for ( auto&& pair_nd_v: ama::g_js_node_map ) {
			ama::Node const* nd = pair_nd_v.first;
			auto& v = pair_nd_v.second;
			mark(Q, nd->Root());
		}
		ama::mark(Q, ama::GetPlaceHolder());
		//recursion
		for (size_t i = intptr_t(0L); i < Q.size(); i += intptr_t(1L)) {
			ama::Node* nd = Q[i];
			ama::mark(Q, nd->c);
			ama::mark(Q, nd->s);
		}
		//sweep
		std::vector<ama::Node*> node_ranges = ama::GetAllPossibleNodeRanges();
		intptr_t n_freed = intptr_t(0L);
		for (int i = 0; i < node_ranges.size(); i += 2) {
			for (ama::Node* nd = node_ranges[i]; nd != node_ranges[i + 1]; nd += 1) {
				if ( (nd->tmp_flags & (ama::TMPF_GC_MARKED | ama::TMPF_IS_NODE)) == ama::TMPF_IS_NODE ) {
					//unreachable but un-free, release
					//console.log('freed node', nd.node_class, nd.data == NULL ? "NULL" : nd.data.c_str());
					n_freed += 1;
					nd->data = nullptr;
					nd->comments_before = nullptr;
					nd->comments_after = nullptr;
					////////////
					memset((void*)(nd), 0, sizeof(ama::Node));
					////////////
					nd->tmp_flags = 0;
					nd->s = ama::g_free_nodes;
					ama::g_free_nodes = nd;
				} else if ( (nd->tmp_flags & (ama::TMPF_GC_MARKED | ama::TMPF_IS_NODE)) == (ama::TMPF_IS_NODE | ama::TMPF_IS_NODE) ) {
					//clear the marked flag for the next gc
					nd->tmp_flags &= ~ama::TMPF_GC_MARKED;
				}
			}
		}
		return n_freed;
	}
};