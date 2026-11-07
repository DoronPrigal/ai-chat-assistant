from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode

from config import OPENAI_API_KEY, OPENAI_MODEL
from agent.tools import tools

# ההוראה הקבועה שמגדירה את אופי הצ'אט. לא נשמרת ב-DB.
SYSTEM_PROMPT = SystemMessage(content=(
    "You are a friendly, helpful AI assistant. "
    "Always answer in the same language as the user's last message. "
    "Keep answers short and clear. Use Markdown (lists, bold, code blocks) when it helps readability."
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


def get_reply(history, user_text):
    """ממיר את ההיסטוריה מה-DB להודעות LangChain, מריץ את הגרף ומחזיר את התשובה הסופית."""
    messages = []
    for message in history:
        if message["role"] == "user":
            messages.append(HumanMessage(content=message["content"]))
        else:
            messages.append(AIMessage(content=message["content"]))
    messages.append(HumanMessage(content=user_text))

    result = agent_app.invoke({"messages": messages})
    return result["messages"][-1].text
