import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Product } from "../data/catalog";
import { OccasionRecommendation } from "../data/occasions";
import { buildLocalSearchSuggestions, SearchSuggestion } from "../lib/aiSearch";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { radius, shadow } from "../lib/styles";
import { SafeImage } from "./SafeImage";
import { StableTextInput } from "./StableTextInput";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitQuery?: (query: string) => void;
  occasion?: OccasionRecommendation | null;
  placeholder?: string;
};

export function AISearchBox({
  value,
  onChangeText,
  onSubmitQuery,
  occasion,
  placeholder,
}: Props) {
  const { theme, user, addSearchTerm } = useApp();
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<SearchSuggestion[]>([]);
  const local = useMemo(
    () => buildLocalSearchSuggestions(value, occasion || null, 10),
    [value, occasion?.key],
  );
  const suggestions = (remote.length ? remote : local).slice(0, 10);
  const bestProduct = suggestions.find((item) => item.product)?.product;

  useEffect(() => {
    const q = value.trim();
    setRemote([]);
    if (!q) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchSuggest({
          q,
          userId: user?.id || "guest",
          occasionKey: occasion?.key || "",
        });
        if (Array.isArray(data?.suggestions)) setRemote(data.suggestions);
      } catch {
        setRemote([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [value, user?.id, occasion?.key]);

  const choose = (item: SearchSuggestion) => {
    if (item.product) {
      addSearchTerm(value || item.title);
      router.push(`/product/${item.product.id}`);
      return;
    }
    const q = item.query || item.title;
    onChangeText(q);
    addSearchTerm(q);
    onSubmitQuery?.(q);
  };

  const showSuggestions = focused || value.trim().length > 0;

  return (
    <View style={{ gap: 8 }}>
      <View
        style={[
          styles.search,
          {
            backgroundColor: theme.card,
            borderColor: focused ? theme.primary : theme.border,
          },
          shadow(theme),
        ]}
      >
        <Feather
          name={value.trim().length > 0 ? "zap" : "search"}
          size={18}
          color={focused ? theme.primary : theme.muted}
        />
        <StableTextInput
          value={value}
          onChangeText={(text) => onChangeText(text)}
          keepKeyboardOnAndroid
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 450)}
          blurOnSubmit={false}
          autoCorrect={false}
          onSubmitEditing={() => {
            addSearchTerm(value);
            if (bestProduct && value.trim().length <= 2)
              router.push(`/product/${bestProduct.id}`);
            else onSubmitQuery?.(value);
          }}
          placeholder={
            placeholder || "Tìm sản phẩm hoặc hỏi AI: hôm nay mặc gì đây?"
          }
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <View style={[styles.aiBadge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.aiBadgeText, { color: theme.background }]}>
              AI
            </Text>
          </View>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <View style={styles.dropdownHeader}>
            <Text style={[styles.dropdownTitle, { color: theme.heading }]}>
              Gợi ý AI realtime
            </Text>
            <Text style={[styles.dropdownSub, { color: theme.muted }]}>
              Nhập 1 chữ để tìm nhanh, hoặc hỏi như chatbot: “hôm nay mặc gì?”
            </Text>
          </View>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            style={{ maxHeight: 330 }}
          >
            {suggestions.map((item, index) => (
              <Pressable
                key={`ai-search-${item.id}-${index}`}
                onPress={() => choose(item)}
                style={[styles.suggestion, { borderTopColor: theme.border }]}
              >
                {item.product ? (
                  <SafeImage
                    source={{ uri: item.product.image }}
                    style={styles.suggestionImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.suggestionIcon,
                      { backgroundColor: theme.background },
                    ]}
                  >
                    <Feather
                      name={
                        item.type === "ai"
                          ? "zap"
                          : item.type === "recent"
                            ? "clock"
                            : "corner-down-right"
                      }
                      size={18}
                      color={theme.primary}
                    />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[styles.suggestionTitle, { color: theme.heading }]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.suggestionSub, { color: theme.muted }]}
                  >
                    {item.subtitle}
                  </Text>
                  {item.reason ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.reasonText, { color: theme.primary }]}
                    >
                      {item.reason}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={theme.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, minHeight: 54, fontSize: 14, fontWeight: "700" },
  aiBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 0},
  aiBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  dropdown: { borderWidth: 1, borderRadius: 0, overflow: "hidden" },
  dropdownHeader: { padding: 12, paddingBottom: 6 },
  dropdownTitle: { fontSize: 16, fontWeight: "900" },
  dropdownSub: { fontSize: 11, marginTop: 2 },
  suggestion: {
    minHeight: 76,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  suggestionImage: { width: 54, height: 54, borderRadius: 0},
  suggestionIcon: {
    width: 54,
    height: 54,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: { fontSize: 14, fontWeight: "900" },
  suggestionSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  reasonText: { fontSize: 10, lineHeight: 14, marginTop: 3, fontWeight: "800" },
});
