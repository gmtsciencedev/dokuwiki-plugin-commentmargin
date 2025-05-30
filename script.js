document.addEventListener('DOMContentLoaded', () => {
    const t = key => window.COMMENTMARGIN_LANG?.[key] || key;
    const commentBoxes = [];

    // Ensure the sidebar container exists
    if (!document.getElementById("commentmargin-sidebar")) {
        const sidebar = document.createElement("div");
        sidebar.id = "commentmargin-sidebar";
        document.body.appendChild(sidebar);
    }

    const injectHighlight = (anchorId, selectedText) => {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);

        const span = document.createElement("span");
        span.id = anchorId;
        span.className = "comment-highlight";
        span.textContent = selectedText;

        range.deleteContents();
        range.insertNode(span);
    };

    function alignCommentBoxToHighlight(anchorID, commentBox) {
        const highlight = document.getElementById(anchorID);
        if (!highlight) return;

        const rect = highlight.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let top = rect.top + scrollTop;

        // Compute cumulative offset if overlapping previous boxes
        let overlapOffset = 0;
        for (const { element } of commentBoxes) {
            if (element === commentBox) continue;

            const otherTop = parseFloat(element.style.top || '0');
            const otherHeight = element.offsetHeight || 0;

            if (top + overlapOffset < otherTop + otherHeight &&
                top + overlapOffset + commentBox.offsetHeight > otherTop) {
                overlapOffset = otherTop + otherHeight - top + 8; // 8px margin
            }
        }

        commentBox.style.top = `${top + overlapOffset}px`;
    };

    const addToSidebar = (anchorId, text, comment) => {
        const div = document.createElement("div");
        div.className = "comment-box";
        div.innerHTML = `<a href="#${anchorId}">${text}</a><p>${comment}</p>`;
        document.body.appendChild(div);
        commentBoxes.push({ anchorId, element: div });

        // Force reflow to ensure bounding boxes are valid
        void div.offsetHeight;

        // Sort based on anchor position
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

    const postComment = async (pageId, selected, comment) => {
        const params = new URLSearchParams({ id: pageId, selected, comment });

        try {
            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            if (result.success && result.anchor_id) {
                injectHighlight(result.anchor_id, selected);
                addToSidebar(result.anchor_id, selected, comment);
                alert(t("js_saved_success"));
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    };

    const btn = document.getElementById('commentmargin-add-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const selection = window.getSelection().toString().trim();
        if (selection.length === 0) {
            alert(t("js_select_text"));
            return;
        }

        const comment = prompt(t("js_enter_comment") + "\n" + selection);
        if (!comment) return;

        const pageId = window.DOKU_ID;
        postComment(pageId, selection, comment);
    });
});
