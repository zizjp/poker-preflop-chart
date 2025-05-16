import json

def load_range_data(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def flatten_hands(table):
    return set(cell for row in table for cell in row if cell)

def compare_ranges(data1, data2):
    results = []
    for action in data1:
        if action not in data2:
            results.append(f"⚠ アクション '{action}' が GTO に存在しません")
            continue

        # ✅ OPENだけ専用構造にする
        if action == "open":
            for pos in data1[action]:
                for stack in data1[action][pos]:
                    if not isinstance(data1[action][pos][stack], dict):
                        continue
                    for rtype in data1[action][pos][stack]:
                        table1 = data1[action][pos][stack][rtype]
                        table2 = data2[action].get(pos, {}).get(stack, {}).get(rtype, [])
                        if not isinstance(table1, list) or not isinstance(table2, list):
                            results.append(f"[{action}] {pos} @ {stack}BB / {rtype}：⚠ データ形式不正")
                            continue
                        hands1 = flatten_hands(table1)
                        hands2 = flatten_hands(table2)
                        only_in_1 = hands1 - hands2
                        only_in_2 = hands2 - hands1
                        common = hands1 & hands2
                        results.append(
                            f"[{action}] {pos} @ {stack}BB / {rtype}："
                            f"共通: {len(common)}｜AIのみ: {len(only_in_1)}｜GTOのみ: {len(only_in_2)}"
                        )
            continue  # openの処理が終わったら次へ

        # 通常のアクション比較
        for pos in data1[action]:
            for vs in data1[action][pos]:
                for stack in data1[action][pos][vs]:
                    if not isinstance(data1[action][pos][vs][stack], dict):
                        results.append(
                            f"[{action}] {pos} vs {vs} @ {stack}BB：⚠ stack階層がdictでないためスキップ"
                        )
                        continue
                    for rtype in data1[action][pos][vs][stack]:
                        table1 = data1[action][pos][vs][stack][rtype]
                        table2 = data2[action].get(pos, {}).get(vs, {}).get(stack, {}).get(rtype, [])
                        if not isinstance(table1, list) or not isinstance(table2, list):
                            results.append(
                                f"[{action}] {pos} vs {vs} @ {stack}BB / {rtype}：⚠ データ形式不正"
                            )
                            continue
                        hands1 = flatten_hands(table1)
                        hands2 = flatten_hands(table2)
                        only_in_1 = hands1 - hands2
                        only_in_2 = hands2 - hands1
                        common = hands1 & hands2
                        results.append(
                            f"[{action}] {pos} vs {vs} @ {stack}BB / {rtype}："
                            f"共通: {len(common)}｜AIのみ: {len(only_in_1)}｜GTOのみ: {len(only_in_2)}"
                        )
    return results

# 使用例（ファイル名は任意で）
data_ai = load_range_data("range_data_ai.json")
data_gto = load_range_data("range_data_gto.json")
diffs = compare_ranges(data_ai, data_gto)

# 表示
for line in diffs:
    print(line)
