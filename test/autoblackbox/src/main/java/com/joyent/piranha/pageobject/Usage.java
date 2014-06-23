package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import java.util.HashMap;
import java.util.Map;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Usage extends AbstractPageObject {
    private static final String TITLE = "Usage";
    private static Map<String, String> repeaters = new HashMap<>();

    public Usage() {
        repeaters.put("Spend", "[data-name=\"'currentspend'\"]");
        repeaters.put("Compute", "[data-name=\"'compute'\"]");
        repeaters.put("Bandwidth", "[data-name=\"'bandwidth'\"]");
        repeaters.put("Manta", "[data-name=\"'manta'\"]");
    }

    @Override
    String getTitle() {
        return TITLE;
    }

    public SelenideElement getViewPreviousButton() {
        return $("[data-ng-show=\"isCurrentMonth\"]");
    }

    public void clickViewPreviousButton() {
        getViewPreviousButton().click();
    }

    public SelenideElement getViewCurrentButton() {
        return $("[data-ng-hide=\"isCurrentMonth\"]");
    }

    public void clickViewCurrentButton() {
        getViewPreviousButton().click();
    }

    public Chart getChart(String name) {
        return new Chart(repeaters.get(name));
    }

    public ChartPage clickOnChart(String chartName) {
        $(repeaters.get(chartName) + " div").click();
        return page(ChartPage.class);
    }
}

