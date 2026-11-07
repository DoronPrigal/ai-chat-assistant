from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode

from config import OPENAI_API_KEY, OPENAI_MODEL
from agent.tools import tools
from images import delete_image, image_exists, image_to_base64

# ההוראה הקבועה שמגדירה את אופי הצ'אט. לא נשמרת ב-DB.
SYSTEM_PROMPT = SystemMessage(content=(
    "You are a friendly, helpful AI assistant. "
    "Always answer in the same language as the user's last message. "
    "Keep answers short and clear. Use Markdown (lists, bold, code blocks) when it helps readability. "
    "When the user asks you to create, draw or design an image, call the generate_image tool once, "
    "with a detailed description in English. The image is shown to the user automatically, so do not "
    "include links, file paths or Markdown images in your answer - just add one short sentence about it. "
    "In code, always write variable, function and class names in English, even when the user writes in "
    "Hebrew (comments and text strings may be in the user's language)."
))

# reasoning_effort="none": תשובה מהירה וזולה. לפי התיעוד של gpt-6-luna, ב-Chat Completions
# קריאה לכלים נתמכת רק בערך הזה. אם מחליפים מודל ב-.env, צריך לבדוק שהוא תומך בפרמטר.
llm = ChatOpenAI(model=OPENAI_MODEL, api_key=OPENAI_API_KEY, reasoning_effort="none")
llm_with_tools = llm.bind_tools(tools)


def call_model(state: MessagesState):
    """Node 'agent': שולח למודל את ההוראה הקבועה ואת ההיסטוריה."""
    response = llm_with_tools.invoke([SYSTEM_PROMPT] + state["messages"])
    return {"messages": [response]}


def should_continue(state: MessagesState):
    """אם המודל ביקש להפעיל כלי עוברים ל-tools, אחרת מסיימים."""
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END


# בניית הגרף: לולאת ReAct
graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, ["tools", END])
graph.add_edge("tools", "agent")
agent_app = graph.compile()


def to_human_message(text, image_path):
    """הודעת משתמש: טקסט בלבד, או טקסט ותמונה יחד (Vision)."""
    if not image_path or not image_exists(image_path):
        return HumanMessage(content=text)
    data, mime_type = image_to_base64(image_path)
    # תמונה בלי טקסט: מבקשים מהמודל לתאר אותה (אחרת הוא עלול ליצור תמונה חדשה). לא נשמר ב-DB.
    return HumanMessage(content=[
        {"type": "text", "text": text or "Describe this image briefly."},
        {"type": "image", "base64": data, "mime_type": mime_type},
    ])


def get_reply(history, user_text, image_path=None):
    """ממיר את ההיסטוריה מה-DB להודעות LangChain, מריץ את הגרף,
    ומחזיר את התשובה הסופית ואת נתיב התמונה שהסוכן יצר (אם יצר)."""
    messages = []
    for message in history:
        if message["role"] == "user":
            messages.append(to_human_message(message["content"], message["image_path"]))
        else:
            text = message["content"]
            if message["image_path"]:
                text += "\n[An image was generated and shown to the user here.]"
            messages.append(AIMessage(content=text))
    messages.append(to_human_message(user_text, image_path))

    # stream עם "updates": מקבלים כל הודעה חדשה מיד כשצומת בגרף מסיים (agent או tools),
    # כדי לדעת על תמונה שנוצרה גם אם הריצה נכשלת אחריה
    generated_images = []
    last_message = None
    try:
        for update in agent_app.stream({"messages": messages}, stream_mode="updates"):
            for node_output in update.values():
                for message in node_output["messages"]:
                    last_message = message
                    # התוצאה של generate_image היא נתיב התמונה שנשמרה
                    if isinstance(message, ToolMessage) and message.name == "generate_image" \
                            and message.text.startswith("/uploads/"):
                        generated_images.append(message.text)
    except Exception:
        # הסוכן נכשל אחרי שתמונה כבר נוצרה: מוחקים את הקובץ, כדי שלא יישאר קובץ בלי הודעה
        for path in generated_images:
            delete_image(path)
        raise

    # נשמרת תמונה אחת להודעה. אם נוצרו כמה (נדיר), שומרים את האחרונה ומוחקים את השאר.
    for path in generated_images[:-1]:
        delete_image(path)
    generated_image = generated_images[-1] if generated_images else None
    return last_message.text, generated_image
