package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Selenide.$;

public class Chart extends AbstractPageObject {
    private String repeater;

    public Chart(String repeater) {
        this.repeater = $(repeater).exists() ? repeater : "";
    }

    public String getChartTitle() {
        return  $(repeater + " h4").text();
    }

    public SelenideElement getTotalUsageDiv() {
        return $(repeater + " div.desc div");
    }

    public SelenideElement getLeftBlockDiv() {
        return $(repeater + " div.left-block div.desc div");
    }

    public String getLeftBlockText() {
        return getLeftBlockDiv().text();
    }

    public String getTotalUsage() {
        return getTotalUsageDiv().text();
    }

    public boolean isChartEmpty() {
        JavascriptExecutor j = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        int size = Integer.parseInt(j.executeScript("return $('" + repeater.replace("'","\\'") + " svg rect[height!=\"0\"]').length").toString());
        return size > 0;
    }
}
