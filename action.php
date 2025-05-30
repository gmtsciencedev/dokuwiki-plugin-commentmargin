<?php
/**
 * Plugin CommentMargin: Add some comment on the margin of a page
 * Author: Raynald de Lahondès
*/


if (!defined('DOKU_INC')) die();

class action_plugin_commentmargin extends DokuWiki_Action_Plugin {


    public function register(Doku_Event_Handler $controller) {
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'inject_translation_script');
        $controller->register_hook('TPL_CONTENT_DISPLAY', 'BEFORE', $this, 'handle_render_comments');
        $controller->register_hook('TPL_SITE_ACTIONS', 'AFTER', $this, 'handle_site_actions');
        $controller->register_hook('MENU_ITEMS_ASSEMBLY', 'AFTER', $this, 'addsvgbutton');
    }

    /**
     * Load all comments for a page from the .comments file
     */
    private function loadComments(string $id): array {
        $file = metaFN($id, '.comments');
        if (!file_exists($file)) return [];

        $json = file_get_contents($file);
        $comments = json_decode($json, true);
        error_log("LOADED COMMENTS: " . print_r($comments, true));
        return is_array($comments) ? $comments : [];
    }

    /**
     * Save a comment to the .comments file
     */
    private function saveComment(string $id, array $data): void {
        $file = metaFN($id, '.comments');
        $comments = $this->loadComments($id);
        $comments[] = $data;
        io_saveFile($file, json_encode($comments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }



    public function inject_translation_script(Doku_Event $event, $param) {
        global $ID;

        $translations = [
            'js_select_text' => $this->getLang('js_select_text'),
            'js_enter_comment' => $this->getLang('js_enter_comment'),
            'js_saved_success' => $this->getLang('js_saved_success'),
            'js_error' => $this->getLang('js_error'),
            'js_unknown_error' => $this->getLang('js_unknown_error'),
            'js_selection_not_found' => $this->getLang('js_selection_not_found'),
        ];

        // Inject language and ID
        echo '<script>window.COMMENTMARGIN_LANG = ' . json_encode($translations) . ';</script>';
        echo '<script>window.DOKU_ID = ' . json_encode($ID) . ';</script>';

        // Also inject script and CSS here — ONLY here
        //echo '<script src="' . DOKU_BASE . 'lib/plugins/commentmargin/script.js"></script>';
        echo '<link rel="stylesheet" href="' . DOKU_BASE . 'lib/plugins/commentmargin/style.css">';
    }
    

    /**
     * Injecte les ancres et les surlignages dans le HTML rendu
     */
    public function handle_render_comments(Doku_Event $event, $param) {
        global $ID;

        $html = & $event->data;
        $comments = $this->loadComments($ID);

        foreach ($comments as $comment) {
            $needle = $comment['selected'];
            $anchor = $comment['anchor_id'];
            $replacement = '<span id="' . hsc($anchor) . '" class="comment-highlight">' . hsc($needle) . '</span>';

            // Remplace la première occurrence uniquement
            $html = preg_replace('/' . preg_quote($needle, '/') . '/', $replacement, $html, 1);
        }
        $html .= '<script id="commentmargin-data" type="application/json">'
            . json_encode($comments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            . '</script>';
    }

    /**
     * Ajoute une icône dans la barre d'actions du site
     */
    public function handle_site_actions(Doku_Event $event, $param) {
        echo "<!-- commentmargin hook reached -->";

        if (auth_quickaclcheck(getID()) < AUTH_EDIT) return;

        echo '<li class="plugin_commentmargin">';
        echo '<a href="#" id="commentmargin-add-btn" title="add_comment">';
        echo '<span class="icon">💬</span>';
        echo '</a></li>';
    }


    public function addsvgbutton(Doku_Event $event, $param) {
        global $INFO;
        if ($event->data['view'] !== 'page') return;
        if (!$INFO['exists']) return;

        $event->data['items'][] = new \dokuwiki\plugin\commentmargin\MenuItem();
    }
}
