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

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const candidates = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue;
        let index = -1;
        while ((index = text.indexOf(selectedText, index + 1)) !== -1) {
            candidates.push({ node, index });
        }
    }

    console.log("Found candidates:", candidates.length);

    const tryInsert = ({ node, index }) => {
        const fullText = node.nodeValue;
        const start = index;
        const end = index + selectedText.length;

        const beforeSafe = before || '';
        const afterSafe = after || '';

        const actualBefore = fullText.slice(Math.max(0, start - beforeSafe.length), start);
        const actualAfter = fullText.slice(end, end + afterSafe.length);

        const matchBefore = beforeSafe === '' || actualBefore === beforeSafe;
        const matchAfter = afterSafe === '' || actualAfter === afterSafe;

        if (matchBefore && matchAfter) {
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);

            const span = document.createElement("span");
            span.id = anchorId;
            span.className = "comment-highlight";
            span.textContent = selectedText;

            range.deleteContents();
            range.insertNode(span);
            return span;
        }

        return null;
    };


    for (const cand of candidates) {
        const res = tryInsert(cand);
        if (res) return res;
    }

    // Fallback path
    console.warn("Fallback mode triggered for", anchorId);
    for (const { node, index } of candidates) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + selectedText.length);

        const span = document.createElement("span");
        span.id = anchorId;
        span.className = "comment-highlight fallback";
        span.textContent = selectedText;

        range.deleteContents();
        range.insertNode(span);
        console.log("Fallback match inserted:", span);
        return span;
    }

    console.warn("No match found for", anchorId);
    return null;
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
    if (Array.isArray(window.COMMENTMARGIN_DATA)) {
        window.COMMENTMARGIN_DATA.forEach(comment => {
            const span = injectHighlight(comment.anchor_id, comment.selected, comment.before || null, comment.after || null);
            if (span) {
                addToSidebar(comment.anchor_id, comment.selected, comment.text);
            }
        });
    }

    const btn = document.getElementById('commentmargin-add-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText.length === 0) {
            alert(t("js_select_text"));
            return;
        }

        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        const full = node.nodeValue || '';

        const before = offset >= 10 ? full.slice(offset - 10, offset) : full.slice(0, offset);
        const after = full.slice(offset + selectedText.length, offset + selectedText.length + 10);

        const comment = prompt(t("js_enter_comment") + "\n" + selectedText);
        if (!comment) return;

        const pageId = window.DOKU_ID;
        postComment(pageId, selectedText, before, after, comment);
    });
});
