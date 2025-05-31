document.addEventListener('DOMContentLoaded', () => {
    const t = key => window.COMMENTMARGIN_LANG?.[key] || key;
    const commentBoxes = [];

    // Ensure the sidebar container exists
    if (!document.getElementById("commentmargin-sidebar")) {
        const sidebar = document.createElement("div");
        sidebar.id = "commentmargin-sidebar";
        document.body.appendChild(sidebar);
    }

    function injectSpansInRange(range, anchorId) {
        const spans = [];
        const textNodes = [];

        const walker = document.createTreeWalker(
            range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentNode
                : range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: node => {
                    return range.intersectsNode(node) && node.nodeValue.trim()
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        // Collect all matching nodes before any modification
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        let count = 0;
        for (const textNode of textNodes) {
            const subrange = document.createRange();
            subrange.selectNodeContents(textNode);

            if (subrange.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
                subrange.setStart(range.startContainer, range.startOffset);
            }
            if (subrange.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
                subrange.setEnd(range.endContainer, range.endOffset);
            }

            const selectedText = subrange.toString();
            if (!selectedText) continue;

            const span = document.createElement("span");
            span.className = "comment-highlight";
            span.id = count === 0 ? anchorId : `${anchorId}_${count}`;
            span.textContent = selectedText;

            subrange.deleteContents();
            subrange.insertNode(span);
            spans.push(span);
            count++;
        }

        console.log("[injectSpansInRange] Highlighted spans count:", spans.length);
        return spans;
    }




    function findMatchingNodesFromHTML(fragment, root) {
        const fragText = fragment.textContent.trim().replace(/\s+/g, ' ');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        while (walker.nextNode()) {
            const candidate = walker.currentNode.cloneNode(true);
            const text = candidate.textContent.trim().replace(/\s+/g, ' ');
            if (text === fragText) {
                return {
                    startNode: walker.currentNode,
                    endNode: walker.currentNode
                };
            }
        }

        return null;
    }


    const injectHighlight = (anchorId, selectedText, before, after, selectedHTML = null) => {
        console.log("[injectHighlight] Start", { anchorId, selectedText, before, after, selectedHTML });

        const beforeSafe = before || '';
        const afterSafe = after || '';

        // STEP 0: remove embedded JSON if present
        const scriptTag = document.getElementById('commentmargin-data');
        if (scriptTag) {
            try {
                scriptTag.remove();
            } catch (err) {
                console.warn("[injectHighlight] Could not remove commentmargin-data script", err);
            }
        }

        // STEP 1: Attempt direct selectedHTML match
        if (selectedHTML) {
            console.log("[injectHighlight] Attempting selectedHTML injection");

            const bodyHTML = document.body.innerHTML;

            const encodedHTML = selectedHTML
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const index = bodyHTML.indexOf(selectedHTML);
            const indexEncoded = bodyHTML.indexOf(encodedHTML);

            const htmlToFind = index !== -1 ? selectedHTML : (indexEncoded !== -1 ? encodedHTML : null);
            const foundAt = index !== -1 ? index : (indexEncoded !== -1 ? indexEncoded : -1);

            console.log("[injectHighlight] selectedHTML match", { index, indexEncoded, foundAt, htmlToFind });

            if (foundAt !== -1) {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = htmlToFind;
                const fragment = tempDiv.cloneNode(true);

                const match = findMatchingNodesFromHTML(fragment, document.body);
                if (match && match.startNode && match.endNode) {
                    console.log("[injectHighlight] selectedHTML DOM match succeeded", match);

                    const range = document.createRange();
                    range.setStartBefore(match.startNode);
                    range.setEndAfter(match.endNode);
                    return injectSpansInRange(range, anchorId)[0] || null;
                } else {
                    console.warn("[injectHighlight] selectedHTML DOM match failed");
                }
            } else {
                console.log("[injectHighlight] selectedHTML not found directly");
            }

            // STEP 1B: Fallback fuzzy selectedHTML textContent match
            const temp = document.createElement("div");
            temp.innerHTML = selectedHTML;
            const textToFind = temp.textContent.trim();

            console.log("[injectHighlight] Fallback textToFind:", JSON.stringify(textToFind));

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let fullText = '';
            const nodes = [];

            while (walker.nextNode()) {
                const node = walker.currentNode;
                const parentTag = node.parentNode?.nodeName?.toUpperCase();
                if (["SCRIPT", "STYLE"].includes(parentTag)) continue;

                nodes.push({ node, start: fullText.length });
                fullText += node.nodeValue;
            }

            const idx = fullText.indexOf(textToFind);
            console.log("[injectHighlight] Fallback flattened text index:", idx);

            if (idx !== -1) {
                let startNode = null, endNode = null;
                let startOffset = 0, endOffset = 0;
                let remainingStart = idx;
                let remainingEnd = idx + textToFind.length;

                for (const { node } of nodes) {
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

                console.log("[injectHighlight] Fallback mapped range", {
                    startNode,
                    startOffset,
                    endNode,
                    endOffset
                });

                if (startNode && endNode) {
                    const range = document.createRange();
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    return injectSpansInRange(range, anchorId)[0] || null;
                } else {
                    console.warn("[injectHighlight] Fallback failed to map to DOM nodes");
                }
            } else {
                console.warn("[injectHighlight] Fallback text not found in fullText");
            }
        }

        // STEP 2: Final fallback – pure textContent match
        console.log("[injectHighlight] Entering final text-based match phase");

        const root = document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let fullText = '';

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            if (["SCRIPT", "STYLE"].includes(parentTag)) continue;

            textNodes.push({ node, start: fullText.length });
            fullText += node.nodeValue;
        }

        let index = fullText.indexOf(selectedText);
        console.log("[injectHighlight] Flattened text match index:", index);

        if (index === -1) {
            console.warn("[injectHighlight] selectedText not found in flattened content");
            return null;
        }

        const actualBefore = fullText.slice(Math.max(0, index - beforeSafe.length), index);
        const actualAfter = fullText.slice(index + selectedText.length, index + selectedText.length + afterSafe.length);

        const relaxedMatchBefore = !beforeSafe || actualBefore.trim().includes(beforeSafe.trim());
        const relaxedMatchAfter = !afterSafe || actualAfter.trim().includes(afterSafe.trim());

        console.log("[injectHighlight] Context match check", {
            index,
            actualBefore,
            actualAfter,
            expectedBefore: beforeSafe,
            expectedAfter: afterSafe,
            relaxedMatchBefore,
            relaxedMatchAfter
        });

        if (!relaxedMatchBefore || !relaxedMatchAfter) {
            console.warn("[injectHighlight] Relaxed context mismatch, attempting unique fallback match");

            const allMatches = [];
            let pos = 0;
            while (pos < fullText.length) {
                const i = fullText.indexOf(selectedText, pos);
                if (i === -1) break;

                const ctxBefore = fullText.slice(Math.max(0, i - beforeSafe.length), i);
                const ctxAfter = fullText.slice(i + selectedText.length, i + selectedText.length + afterSafe.length);
                const matchOK = (!beforeSafe || ctxBefore.includes(beforeSafe)) && (!afterSafe || ctxAfter.includes(afterSafe));
                if (matchOK) allMatches.push(i);

                pos = i + selectedText.length;
            }

            console.log("[injectHighlight] Fallback matches:", allMatches);

            if (allMatches.length === 1) {
                index = allMatches[0];
            } else {
                console.warn("[injectHighlight] Ambiguous or missing fallback match");
                return null;
            }
        }

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

        if (!startNode || !endNode) {
            console.warn("[injectHighlight] Final fallback: failed to map offsets to DOM");
            return null;
        }

        console.log("[injectHighlight] Final fallback success. Creating range and span...", {
            startNode: startNode.nodeValue?.slice(0, 30),
            startOffset,
            endNode: endNode.nodeValue?.slice(0, 30),
            endOffset
        });

        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        return injectSpansInRange(range, anchorId)[0] || null;
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

        div.innerHTML = `
            <a href="#${anchorId}">${text}</a>
            <p class="comment-text">${comment}</p>
            <div class="comment-actions">
                <button class="comment-edit">✏️</button>
                <button class="comment-delete">🗑️</button>
            </div>
        `;

        document.body.appendChild(div);
        commentBoxes.push({ anchorId, element: div });

        div.querySelector('.comment-edit').addEventListener('click', () => {
            const newText = prompt(t("js_edit_comment"), comment);
            if (newText && newText !== comment) {
                fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        id: window.DOKU_ID,
                        action: "update",
                        anchor_id: anchorId,
                        new_text: newText
                    })
                }).then(res => res.json()).then(result => {
                    if (result.success) {
                        div.querySelector('.comment-text').textContent = newText;
                    } else {
                        alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
                    }
                });
            }
        });

        div.querySelector('.comment-delete').addEventListener('click', () => {
            if (!confirm(t("js_confirm_delete"))) return;

            fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    id: window.DOKU_ID,
                    action: "delete",
                    anchor_id: anchorId
                })
            }).then(res => res.json()).then(result => {
                if (result.success) {
                    div.remove();
                    const highlight = document.getElementById(anchorId);
                    if (highlight) highlight.classList.remove('comment-highlight');
                } else {
                    alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
                }
            });
        });

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
            document.body.appendChild(element);
            element.style.top = '';
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

    const postComment = async (pageId, selected, before, after, comment, selectedHTML) => {
        // Try to inject temporarily to validate selection
        const testSpan = injectHighlight("__preview__", selected, before, after, selectedHTML);
        if (!testSpan) {
            alert(t("js_selection_not_found"));
            return; // Abort submission
        }
        testSpan.remove(); // Clean up the temporary preview

        const params = new URLSearchParams({
            id: pageId,
            selected,
            before,
            after,
            comment,
            selected_html: selectedHTML
        });

        try {
            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            if (result.success) {
                location.reload(); // reload to reflect the newly saved comment
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    };

    async function updateComment(anchorId, newText) {
        try {
            const params = new URLSearchParams({
                action: "update",
                anchor_id: anchorId,
                new_text: newText,
                id: window.DOKU_ID
            });

            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            if (result.success) {
                location.reload();
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    }

    async function deleteComment(anchorId) {
        try {
            const params = new URLSearchParams({
                action: "delete",
                anchor_id: anchorId,
                id: window.DOKU_ID
            });

            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            if (result.success) {
                location.reload();
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    }



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
            const span = injectHighlight(comment.anchor_id, comment.selected, comment.before || null, comment.after || null, comment.selected_html || null);
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
        console.log("Selected text:", JSON.stringify(selectedText));
        
        // Capture HTML instead of just text
        const getSelectedHTML = () => {
            if (selection.rangeCount === 0) return '';
            const range = selection.getRangeAt(0);
            const container = document.createElement("div");
            container.appendChild(range.cloneContents());
            return container.innerHTML;
        };

        const selectedHTML = getSelectedHTML().trim();
        if (!selectedHTML) {
            alert("Could not capture HTML selection.");
            return;
        }

        let before = "";
        let after = "";

        try {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.nodeType === 1
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentNode;

            const fullText = container.textContent;
            console.log("Full flattened text:", fullText.includes(selectedText));
            const index = fullText.indexOf(selectedText);

            if (index !== -1) {
                const contextSize = 20;
                before = fullText.slice(Math.max(0, index - contextSize), index);
                after = fullText.slice(index + selectedText.length, index + selectedText.length + contextSize);
            } else {
                console.warn("Text-based context could not be computed, relying on selectedHTML only.");
            }
        } catch (err) {
            console.warn("Error while computing before/after:", err);
        }

        const comment = prompt(t("js_enter_comment") + "\n" + selectedText);
        if (!comment) return;

        const pageId = window.DOKU_ID;
        postComment(pageId, selectedText, before, after, comment, selectedHTML);
    });


});
