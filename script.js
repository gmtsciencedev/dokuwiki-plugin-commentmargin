document.addEventListener('DOMContentLoaded', () => {
    const t = key => window.COMMENTMARGIN_LANG?.[key] || key;
    const commentBoxes = [];

    // Ensure the sidebar container exists
    if (!document.getElementById("commentmargin-sidebar")) {
        const sidebar = document.createElement("div");
        sidebar.id = "commentmargin-sidebar";
        document.body.appendChild(sidebar);
    }

    const injectHighlight = (anchorId, selectedText, before, after) => {
        console.log("Injecting:", { anchorId, selectedText, before, after });

        const beforeSafe = before || '';
        const afterSafe = after || '';

        // Optional: remove the embedded JSON once used
        const scriptTag = document.getElementById('commentmargin-data');
        if (scriptTag) {
            try {
                scriptTag.remove();
            } catch (err) {
                console.warn("injectHighlight: couldn't remove script tag", err);
            }
        }

        // Step 1: Flatten all visible text nodes
        const root = document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let fullText = '';

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            if (parentTag === "SCRIPT" || parentTag === "STYLE") continue;

            textNodes.push({ node, start: fullText.length });
            fullText += node.nodeValue;
        }

        // Step 2: Try matching the full string
        let index = fullText.indexOf(selectedText);
        if (index === -1) {
            console.warn("injectHighlight: selectedText not found in flattened content");
            return null;
        }

        const actualBefore = fullText.slice(Math.max(0, index - beforeSafe.length), index);
        const actualAfter = fullText.slice(index + selectedText.length, index + selectedText.length + afterSafe.length);

        const relaxedMatchBefore = !beforeSafe || actualBefore.trim().includes(beforeSafe.trim());
        const relaxedMatchAfter = !afterSafe || actualAfter.trim().includes(afterSafe.trim());

        console.log("Match context:", {
            index,
            actualBefore,
            actualAfter,
            expectedBefore: beforeSafe,
            expectedAfter: afterSafe,
            relaxedMatchBefore,
            relaxedMatchAfter
        });

        if (!relaxedMatchBefore || !relaxedMatchAfter) {
            console.warn("injectHighlight: relaxed context mismatch, attempting fallback");

            const allOccurrences = [];
            let pos = 0;
            while (pos < fullText.length) {
                const i = fullText.indexOf(selectedText, pos);
                if (i === -1) break;
                allOccurrences.push(i);
                pos = i + selectedText.length;
            }

            if (allOccurrences.length === 1) {
                console.info("injectHighlight: using fallback injection due to unique match");
                index = allOccurrences[0];
            } else {
                console.warn("injectHighlight: ambiguous fallback match — multiple matches");
                return null;
            }
        }

        // Step 3: Map offsets back to nodes
        let startNode = null, endNode = null;
        let startOffset = 0, endOffset = 0;
        let remainingStart = index;
        let remainingEnd = index + selectedText.length;

        for (const { node } of textNodes) {
            const len = node.nodeValue.length;

            if (!startNode && remainingStart < len) {
                startNode = node;
                startOffset = remainingStart;
            }
            remainingStart -= len;

            if (!endNode && remainingEnd <= len) {
                endNode = node;
                endOffset = remainingEnd;
                break;
            }
            remainingEnd -= len;
        }

        console.log("Highlight range:", {
            startNode: startNode?.nodeValue?.slice(0, 30) + "...",
            startOffset,
            endNode: endNode?.nodeValue?.slice(0, 30) + "...",
            endOffset
        });

        if (!startNode || !endNode) {
            console.warn("injectHighlight: failed to map DOM nodes");
            return null;
        }

        const range = document.createRange();
        try {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
        } catch (err) {
            console.error("injectHighlight: error creating range", err);
            return null;
        }

        const span = document.createElement("span");
        span.id = anchorId;
        span.className = "comment-highlight";
        span.textContent = selectedText;

        range.deleteContents();
        range.insertNode(span);
        return span;
    };








    function alignCommentBoxToHighlight(anchorID, commentBox) {
        const highlight = document.getElementById(anchorID);
        if (!highlight) return;

        const rect = highlight.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let top = rect.top + scrollTop;

        // Avoid overlaps
        let overlapOffset = 0;
        for (const { element } of commentBoxes) {
            if (element === commentBox) continue;

            const otherTop = parseFloat(element.style.top || '0');
            const otherHeight = element.offsetHeight || 0;

            if (top + overlapOffset < otherTop + otherHeight &&
                top + overlapOffset + commentBox.offsetHeight > otherTop) {
                overlapOffset = otherTop + otherHeight - top + 8;
            }
        }

        commentBox.style.top = `${top + overlapOffset}px`;
    }

    const addToSidebar = (anchorId, text, comment) => {
        const div = document.createElement("div");
        div.className = "comment-box";
        div.innerHTML = `<a href="#${anchorId}">${text}</a><p>${comment}</p>`;
        document.body.appendChild(div);
        commentBoxes.push({ anchorId, element: div });

        void div.offsetHeight;

        commentBoxes.sort((a, b) => {
            const elA = document.getElementById(a.anchorId);
            const elB = document.getElementById(b.anchorId);
            if (!elA || !elB) return 0;

            const pos = elA.compareDocumentPosition(elB);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });

        commentBoxes.forEach(({ element }) => {
            document.body.appendChild(element); // move in DOM to match sort order
            element.style.top = ''; // reset position to avoid stale overlap
        });

        commentBoxes.forEach(({ anchorId, element }) => {
            alignCommentBoxToHighlight(anchorId, element);
        });

     };

    window.addEventListener('scroll', () => {
        commentBoxes.forEach(({ anchorId, element }) => alignCommentBoxToHighlight(anchorId, element));
    });

    window.addEventListener('resize', () => {
        commentBoxes.forEach(({ anchorId, element }) => alignCommentBoxToHighlight(anchorId, element));
    });
    const postComment = async (pageId, selected, before, after, comment) => {
        const params = new URLSearchParams({ id: pageId, selected, before, after, comment });

        try {
            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            //if (result.success && result.anchor_id) {
            //    injectHighlight(result.anchor_id, selected, before, after);
            //    addToSidebar(result.anchor_id, selected, comment);
            //    //alert(t("js_saved_success"));
            if (result.success) {
                location.reload(); // force a full reload to re-read comment from backend
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    };

    // Load pre-existing comments if available
    function loadCommentData() {
        const raw = document.getElementById('commentmargin-data')?.textContent;
        if (!raw) {
            console.warn("No comment data found");
            return [];
        }

        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error("Failed to parse comment data:", err);
            return [];
        }
    }

    const COMMENTMARGIN_DATA = loadCommentData();

    if (Array.isArray(COMMENTMARGIN_DATA)) {
        COMMENTMARGIN_DATA.forEach(comment => {
            const span = injectHighlight(comment.anchor_id, comment.selected, comment.before || null, comment.after || null);
            if (span) {
                addToSidebar(comment.anchor_id, comment.selected, comment.text);
            }
        });
    }

    // Immediately clean up to prevent polluting textContent
    //const scriptTags = document.querySelectorAll('script');
    //scriptTags.forEach(script => {
    //    if (script.textContent.includes('window.COMMENTMARGIN_DATA')) {
    //        script.remove();
    //    }
    //});

    const btn = document.getElementById('commentmargin-add-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (!selectedText) {
            alert(t("js_select_text"));
            return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentNode;

        const fullText = container.textContent;
        const index = fullText.indexOf(selectedText);

        if (index === -1) {
            alert("Could not determine selection position in the text.");
            return;
        }

        const contextSize = 20;
        const before = fullText.slice(Math.max(0, index - contextSize), index);
        const after = fullText.slice(index + selectedText.length, index + selectedText.length + contextSize);

        const comment = prompt(t("js_enter_comment") + "\n" + selectedText);
        if (!comment) return;

        const pageId = window.DOKU_ID;
        postComment(pageId, selectedText, before, after, comment);
    });
});
