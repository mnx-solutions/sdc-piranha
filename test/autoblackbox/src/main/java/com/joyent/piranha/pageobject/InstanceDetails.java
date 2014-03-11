package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;

public class InstanceDetails extends AbstractPageObject {
    private final String name;

    public InstanceDetails(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }


    public void checkHeadingText() {
        checkHeadingText(name);
    }

    public ElementsCollection getChartElements() {
        return $$(".detail_chart");
    }

    public Analytics clickDetailedAnalytics() {
        $("#button-detailed-analytics").click();
        return page(Analytics.class);
    }
}
